import cron from "node-cron";
import mongoose from "mongoose";
import { load } from "cheerio";
import os from "node:os";

import { autoUpdateViHentaiManga } from "@/services/importers/vi-hentai-importer";
import { SystemLockModel } from "~/database/models/system-lock.model";
import { ViHentaiAutoUpdateQueueModel } from "~/database/models/vi-hentai-auto-update-queue.model";
import { MANGA_CONTENT_TYPE } from "~/constants/manga";
import { getFeatureFlag, setFeatureFlag } from "~/.server/services/system-feature-flag.server";

const TZ = "Asia/Ho_Chi_Minh";
const LOCK_KEY = "vi-hentai-auto-update";

const getVietnamMinutes = (): number | null => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "NaN");
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "NaN");
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return hour * 60 + minute;
  } catch {
    return null;
  }
};

const isVietnamBlackoutWindow = (): boolean => {
  const minutes = getVietnamMinutes();
  if (minutes == null) return false;

  const inMidday = minutes >= 11 * 60 + 30 && minutes < 13 * 60 + 30;
  const inLate = minutes >= 21 * 60 + 30 || minutes < 30;
  return inMidday || inLate;
};

// We keep extraction and processing separated:
// - Extraction builds a queue of URLs (30 items) without downloading.
// - Processing consumes that queue later (background worker).
const DEFAULT_MAX_MANGA = 30;

// When auto-update starts, wait for any in-flight auto-download job to finish.
const WAIT_AUTO_DOWNLOAD_IDLE_TIMEOUT_MS = 25 * 60 * 1000;

const DEFAULT_LIST_URL = "https://vi-hentai.pro/danh-sach?page=1";
const DEFAULT_OWNER_ID = "68f0f839b69df690049aba65";

const FEATURE_FLAG_KEY = "viHentaiAutoUpdateEnabled";
const DEFAULT_ENABLED = true;

const FEATURE_FLAG_STOP_EARLY_KEY = "viHentaiAutoUpdateStopEarlyEnabled";
const DEFAULT_STOP_EARLY_ENABLED = true;

export const getViHentaiAutoUpdateEnabled = async (): Promise<boolean> => {
  return getFeatureFlag(FEATURE_FLAG_KEY, DEFAULT_ENABLED);
};

export const getViHentaiAutoUpdateStopEarlyEnabled = async (): Promise<boolean> => {
  return getFeatureFlag(FEATURE_FLAG_STOP_EARLY_KEY, DEFAULT_STOP_EARLY_ENABLED);
};

const pauseAllRunningQueues = async (): Promise<void> => {
  const runningQueues = await ViHentaiAutoUpdateQueueModel.find({ status: "running" })
    .select({ _id: 1, listUrl: 1, items: 1 })
    .lean();

  for (const q of runningQueues as any[]) {
    const items = Array.isArray(q.items) ? q.items : [];
    const patchedItems = items.map((it: any) => {
      if (it?.status === "running") {
        return { ...it, status: "queued" };
      }
      return it;
    });

    await ViHentaiAutoUpdateQueueModel.updateOne(
      { _id: q._id },
      {
        $set: {
          status: "paused",
          items: patchedItems,
        },
        $push: {
          errors: {
            url: String((q as any).listUrl || ""),
            message: "Hệ thống đã tắt auto-update (paused)",
          },
        },
      },
    );
  }
};

const resumeAllPausedQueues = async (): Promise<void> => {
  await ViHentaiAutoUpdateQueueModel.updateMany(
    { status: "paused" },
    { $set: { status: "queued" } },
  );
};

export const setViHentaiAutoUpdateEnabled = async (enabled: boolean): Promise<boolean> => {
  const value = await setFeatureFlag(FEATURE_FLAG_KEY, enabled);
  if (!value) {
    await pauseAllRunningQueues();
  } else {
    await resumeAllPausedQueues();
  }
  return value;
};

export const setViHentaiAutoUpdateStopEarlyEnabled = async (enabled: boolean): Promise<boolean> => {
  return setFeatureFlag(FEATURE_FLAG_STOP_EARLY_KEY, enabled);
};

const getOwnerId = () => {
  // IMPORTANT: keep this stable across process restarts.
  // If we include pid, a crash/restart can leave a lock that the restarted process
  // can no longer release, which blocks both auto-update and auto-download.
  const parts = [
    process.env.PM2_HOME ? "pm2" : "node",
    process.env.NODE_APP_INSTANCE != null ? `inst:${process.env.NODE_APP_INSTANCE}` : undefined,
    process.env.PORT ? `port:${process.env.PORT}` : undefined,
    `host:${os.hostname()}`,
  ].filter(Boolean);
  return parts.join("|");
};

const isAllowedHost = (host: string) => {
  const h = host.toLowerCase();
  return h === "vi-hentai.pro" || h.endsWith(".vi-hentai.pro");
};

const normalizeViHentaiHostToPro = (url: URL): void => {
  const host = url.hostname.toLowerCase();
  if (host === "vi-hentai.moe") {
    url.hostname = "vi-hentai.pro";
    return;
  }
  if (host.endsWith(".vi-hentai.moe")) {
    url.hostname = `${host.slice(0, -"vi-hentai.moe".length)}vi-hentai.pro`;
  }
};

const tryAcquireLock = async (ttlMs: number): Promise<boolean> => {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + ttlMs);
  const lockedBy = getOwnerId();

  const updated = await SystemLockModel.findOneAndUpdate(
    {
      key: LOCK_KEY,
      $or: [{ lockedUntil: { $lte: now } }, { lockedUntil: { $exists: false } }, { lockedBy }],
    },
    { $set: { lockedUntil, lockedBy } },
    { new: true },
  ).lean();

  if (updated) return true;

  try {
    await SystemLockModel.create({ key: LOCK_KEY, lockedUntil, lockedBy });
    return true;
  } catch {
    return false;
  }
};

const releaseLock = async (): Promise<void> => {
  const now = new Date();
  const lockedBy = getOwnerId();
  try {
    await SystemLockModel.updateOne({ key: LOCK_KEY, lockedBy }, { $set: { lockedUntil: now } });
  } catch {
    // best-effort
  }
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const waitForAutoDownloadIdle = async (timeoutMs: number): Promise<boolean> => {
  const startedAt = Date.now();

  // Lazy import to avoid loading the model unless needed.
  const { ViHentaiAutoDownloadJobModel } = await import("~/database/models/vi-hentai-auto-download-job.model");

  while (Date.now() - startedAt < timeoutMs) {
    const running = await ViHentaiAutoDownloadJobModel.findOne({ status: "running" })
      .select({ _id: 1 })
      .lean();
    if (!running) return true;
    await sleep(2_000);
  }

  return false;
};

const extractMangaLinksFromListingHtml = (html: string, listingUrl: URL): string[] => {
  const $ = load(html);

  const isMangaPathname = (pathname: string) => {
    return /^\/truyen\/[^\/]+\/?$/.test(pathname);
  };

  const normalizeMangaUrl = (rawHref: string) => {
    try {
      const u = new URL(rawHref, listingUrl.origin);
      const pathname = u.pathname.replace(/\/+$/, "");
      if (!isMangaPathname(`${pathname}/`)) return null;
      return `${listingUrl.origin}${pathname}`;
    } catch {
      return null;
    }
  };

  const MAX_LINKS = 2000;
  const seen = new Set<string>();
  const links: string[] = [];

  $("a[href]")
    .toArray()
    .forEach((el) => {
      if (links.length >= MAX_LINKS) return;
      const href = String($(el).attr("href") || "").trim();
      if (!href) return;
      if (href.includes("/truyen-hentai")) return;
      if (!href.includes("/truyen/")) return;

      const normalized = normalizeMangaUrl(href);
      if (!normalized) return;
      if (seen.has(normalized)) return;
      seen.add(normalized);
      links.push(normalized);
    });

  return links;
};

export type CreateViHentaiAutoUpdateQueueOptions = {
  listUrl?: string;
  maxManga?: number;
  maxNewChaptersPerManga?: number;
  /** Optional override for env `VIHENTAI_AUTO_UPDATE_OWNER_ID` (used when allowCreateNewManga=true). */
  ownerId?: string;
  /** Whether newly created manga should be auto-approved (default: true if env not set). */
  approveNewManga?: boolean;
};

const isValidMongoObjectId = (value?: string) => {
  if (!value) return false;
  return /^[a-f\d]{24}$/i.test(value.trim());
};

export const runViHentaiAutoUpdateOnce = async (
  options: CreateViHentaiAutoUpdateQueueOptions = {},
): Promise<{ ok: boolean; runId?: string; message?: string }> => {
  if (!(await getViHentaiAutoUpdateEnabled())) {
    return { ok: false, message: "Auto-update đang tắt" };
  }
  // Back-compat: old API name kept, but now it creates a queue and starts it.
  const listUrlRaw = (options.listUrl || process.env.VIHENTAI_AUTO_UPDATE_LIST_URL || DEFAULT_LIST_URL).trim();

  let listUrl: URL;
  try {
    listUrl = new URL(listUrlRaw);
  } catch {
    return { ok: false, message: "listUrl không hợp lệ" };
  }

  // Force the canonical vi-hentai.pro domain (prevents .moe URLs from leaking into runs).
  normalizeViHentaiHostToPro(listUrl);

  if (!/^https?:$/.test(listUrl.protocol)) {
    return { ok: false, message: "listUrl không hợp lệ (chỉ hỗ trợ http/https)" };
  }

  if (!isAllowedHost(listUrl.hostname)) {
    return { ok: false, message: "listUrl không thuộc vi-hentai.pro" };
  }

  const maxManga =
    typeof options.maxManga === "number" && options.maxManga > 0
      ? options.maxManga
      : Number.parseInt(String(process.env.VIHENTAI_AUTO_UPDATE_MAX_MANGA || String(DEFAULT_MAX_MANGA)), 10) ||
        DEFAULT_MAX_MANGA;

  const maxNewChaptersPerManga =
    typeof options.maxNewChaptersPerManga === "number" && options.maxNewChaptersPerManga > 0
      ? options.maxNewChaptersPerManga
      : Number.parseInt(String(process.env.VIHENTAI_AUTO_UPDATE_MAX_NEW_CHAPTERS || "20"), 10) || 20;

  const lockedBy = getOwnerId();

  const ownerId = (options.ownerId || process.env.VIHENTAI_AUTO_UPDATE_OWNER_ID || DEFAULT_OWNER_ID).trim();
  if (ownerId && !isValidMongoObjectId(ownerId)) {
    return { ok: false, message: "ownerId không hợp lệ" };
  }
  if (!ownerId) {
    return { ok: false, message: "Thiếu ownerId để tạo truyện mới" };
  }
  const translationTeam = (process.env.VIHENTAI_AUTO_UPDATE_TRANSLATION_TEAM || "").trim() || undefined;
  const envApproveRaw = process.env.VIHENTAI_AUTO_UPDATE_APPROVE;
  const envApprove =
    envApproveRaw != null && String(envApproveRaw).trim() !== ""
      ? String(envApproveRaw).trim() === "1"
      : undefined;
  const approveNewManga =
    typeof options.approveNewManga === "boolean" ? options.approveNewManga : (envApprove ?? true);
  const approve = approveNewManga;
  const contentType =
    String(process.env.VIHENTAI_AUTO_UPDATE_CONTENT_TYPE || "MANGA").toUpperCase() === "COSPLAY"
      ? MANGA_CONTENT_TYPE.COSPLAY
      : MANGA_CONTENT_TYPE.MANGA;

  // Phase 1: extract + create queue (30 urls)
  const createdQueue = await createViHentaiAutoUpdateQueue({
    listUrl: listUrl.toString(),
    maxManga,
    maxNewChaptersPerManga,
    ownerId,
    approveNewManga,
  });
  if (!createdQueue.ok) return { ok: false, message: createdQueue.message };

  // Phase 2: mark running (actual downloading happens in background worker)
  await ViHentaiAutoUpdateQueueModel.updateOne(
    { _id: createdQueue.queueId },
    { $set: { status: "running", startedAt: new Date(), lockedBy } },
  );

  return { ok: true, runId: createdQueue.queueId };
};

export const createViHentaiAutoUpdateQueue = async (
  options: CreateViHentaiAutoUpdateQueueOptions = {},
): Promise<{ ok: boolean; queueId?: string; message?: string }> => {
  if (!(await getViHentaiAutoUpdateEnabled())) {
    return { ok: false, message: "Auto-update đang tắt" };
  }
  const listUrlRaw = (options.listUrl || process.env.VIHENTAI_AUTO_UPDATE_LIST_URL || DEFAULT_LIST_URL).trim();

  let listUrl: URL;
  try {
    listUrl = new URL(listUrlRaw);
  } catch {
    return { ok: false, message: "listUrl không hợp lệ" };
  }

  normalizeViHentaiHostToPro(listUrl);
  if (!/^https?:$/.test(listUrl.protocol)) {
    return { ok: false, message: "listUrl không hợp lệ (chỉ hỗ trợ http/https)" };
  }
  if (!isAllowedHost(listUrl.hostname)) {
    return { ok: false, message: "listUrl không thuộc vi-hentai.pro" };
  }

  const maxManga =
    typeof options.maxManga === "number" && options.maxManga > 0 ? options.maxManga : DEFAULT_MAX_MANGA;
  const maxNewChaptersPerManga =
    typeof options.maxNewChaptersPerManga === "number" && options.maxNewChaptersPerManga > 0
      ? options.maxNewChaptersPerManga
      : 20;

  const ownerId = (options.ownerId || process.env.VIHENTAI_AUTO_UPDATE_OWNER_ID || DEFAULT_OWNER_ID).trim();
  if (ownerId && !isValidMongoObjectId(ownerId)) {
    return { ok: false, message: "ownerId không hợp lệ" };
  }
  if (!ownerId) {
    return { ok: false, message: "Thiếu ownerId để tạo truyện mới" };
  }

  const envApproveRaw = process.env.VIHENTAI_AUTO_UPDATE_APPROVE;
  const envApprove =
    envApproveRaw != null && String(envApproveRaw).trim() !== ""
      ? String(envApproveRaw).trim() === "1"
      : undefined;
  const approveNewManga =
    typeof options.approveNewManga === "boolean" ? options.approveNewManga : (envApprove ?? true);

  const res = await fetch(listUrl.toString(), {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept-Language": "vi,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!res.ok) {
    return { ok: false, message: `Không thể tải list (${res.status} ${res.statusText})` };
  }

  const html = await res.text();
  const links = extractMangaLinksFromListingHtml(html, listUrl);
  const selected = links.slice(0, Math.max(0, maxManga));

  const lockedBy = getOwnerId();
  const queue = await ViHentaiAutoUpdateQueueModel.create({
    status: "queued",
    listUrl: listUrl.toString(),
    maxManga,
    maxNewChaptersPerManga,
    ownerId,
    approveNewManga,
    lockedBy,
    processed: 0,
    created: 0,
    updated: 0,
    noop: 0,
    chaptersAdded: 0,
    imagesUploaded: 0,
    items: selected.map((url, idx) => ({
      index: idx + 1,
      url,
      status: "queued",
    })),
    errors:
      links.length < maxManga
        ? [
            {
              url: listUrl.toString(),
              message: `Chỉ lấy được ${links.length} URL từ list (cần ${maxManga}). Có thể upstream thay đổi HTML hoặc thiếu dữ liệu.`,
            },
          ]
        : [],
  });

  return { ok: true, queueId: String((queue as any)._id) };
};

export const startViHentaiAutoUpdateQueue = async (queueId: string): Promise<boolean> => {
  if (!queueId) return false;
  if (!(await getViHentaiAutoUpdateEnabled())) return false;

  // Ensure we only have a single active running queue at a time.
  const otherRunning = await ViHentaiAutoUpdateQueueModel.exists({ status: "running", _id: { $ne: queueId } });
  if (otherRunning) return false;

  const res = await ViHentaiAutoUpdateQueueModel.updateOne(
    { _id: queueId, status: { $in: ["queued", "failed"] } },
    { $set: { status: "running", startedAt: new Date() } },
  );
  return Boolean((res as any).modifiedCount || (res as any).nModified);
};

const processViHentaiAutoUpdateQueue = async (queueId: string): Promise<void> => {
  if (!(await getViHentaiAutoUpdateEnabled())) return;
  const queue = await ViHentaiAutoUpdateQueueModel.findById(queueId).lean();
  if (!queue) return;
  if ((queue as any).status !== "running") return;

  const ensureQueueStillRunning = async (): Promise<boolean> => {
    const fresh = await ViHentaiAutoUpdateQueueModel.findById(queueId)
      .select({ status: 1 })
      .lean();
    return Boolean(fresh && (fresh as any).status === "running");
  };

  const STOP_AFTER_CONSECUTIVE_NOOP_OR_FAILED = 5;
  let consecutiveNoopOrFailed = 0;
  const listUrl = String((queue as any).listUrl || "");

  const stopEarly = async (reason: string): Promise<void> => {
    const now = new Date();
    // Mark the queue as completed, and also finalize any remaining queued/running items
    // so the UI doesn't show items stuck in "queued".
    await ViHentaiAutoUpdateQueueModel.updateOne(
      { _id: queueId, status: "running" },
      {
        $set: {
          status: "succeeded",
          finishedAt: now,
          "items.$[x].status": "noop",
          "items.$[x].mode": "stopped",
          "items.$[x].message": reason,
          "items.$[x].finishedAt": now,
        },
        $push: {
          errors: {
            url: listUrl,
            message: reason,
          },
        },
      },
      { arrayFilters: [{ "x.status": { $in: ["queued", "running"] } }] } as any,
    );
  };

  // Avoid concurrency with auto-download batch.
  const idle = await waitForAutoDownloadIdle(WAIT_AUTO_DOWNLOAD_IDLE_TIMEOUT_MS);
  if (!idle) {
    await ViHentaiAutoUpdateQueueModel.updateOne(
      { _id: queueId },
      {
        $set: { status: "failed", finishedAt: new Date() },
        $push: {
          errors: {
            url: String((queue as any).listUrl || ""),
            message: "Đang có batch tải truyện tự động chạy quá lâu; queue tạm hoãn",
          },
        },
      },
    );
    return;
  }

  const ownerId = String((queue as any).ownerId || "").trim();
  if (!ownerId) {
    await ViHentaiAutoUpdateQueueModel.updateOne(
      { _id: queueId },
      {
        $set: { status: "failed", finishedAt: new Date() },
        $push: { errors: { url: String((queue as any).listUrl || ""), message: "Thiếu ownerId" } },
      },
    );
    return;
  }

  const translationTeam = (process.env.VIHENTAI_AUTO_UPDATE_TRANSLATION_TEAM || "").trim() || undefined;
  const approveNewManga = Boolean((queue as any).approveNewManga ?? true);
  const contentType =
    String(process.env.VIHENTAI_AUTO_UPDATE_CONTENT_TYPE || "MANGA").toUpperCase() === "COSPLAY"
      ? MANGA_CONTENT_TYPE.COSPLAY
      : MANGA_CONTENT_TYPE.MANGA;
  const maxNewChaptersPerManga = Number((queue as any).maxNewChaptersPerManga || 20);

  const items: any[] = Array.isArray((queue as any).items) ? (queue as any).items : [];

  for (let i = 0; i < items.length; i += 1) {
    // Allow admin to pause/delete an in-progress queue.
    if (!(await ensureQueueStillRunning())) return;

    if (!(await getViHentaiAutoUpdateEnabled())) {
      await ViHentaiAutoUpdateQueueModel.updateOne(
        { _id: queueId, status: "running" },
        {
          $set: { status: "paused" },
          $push: {
            errors: {
              url: String((queue as any).listUrl || ""),
              message: "Auto-update đã bị tắt trong lúc đang chạy (paused)",
            },
          },
        },
      );
      return;
    }

    const it = items[i];
    const index = Number(it.index || i + 1);
    const url = String(it.url || "").trim();

    // Skip finished items (supports resume after restart)
    if (it.status === "succeeded") {
      consecutiveNoopOrFailed = 0;
      continue;
    }
    if (it.status === "noop") {
      consecutiveNoopOrFailed += 1;
      if (
        consecutiveNoopOrFailed >= STOP_AFTER_CONSECUTIVE_NOOP_OR_FAILED &&
        (await getViHentaiAutoUpdateStopEarlyEnabled())
      ) {
        await stopEarly(
          `Dừng sớm: ${STOP_AFTER_CONSECUTIVE_NOOP_OR_FAILED} truyện liên tiếp ở trạng thái noop/failed (mới nhất: #${index} ${url})`,
        );
        return;
      }
      continue;
    }

    await ViHentaiAutoUpdateQueueModel.updateOne(
      { _id: queueId },
      {
        $set: {
          "items.$[x].status": "running",
          "items.$[x].startedAt": new Date(),
        },
      },
      { arrayFilters: [{ "x.index": index }] } as any,
    );

    try {
      const result = await autoUpdateViHentaiManga({
        request: new Request("http://internal/vi-hentai-auto-update-queue"),
        url,
        ownerId,
        translationTeam,
        approve: approveNewManga,
        contentType,
        asSystem: true,
        downloadPoster: true,
        downloadChapters: true,
        maxNewChapters: maxNewChaptersPerManga,
        maxChaptersForNewManga: 200,
        imageDelayMs: 100,
      } as any);

      const inc: any = {
        processed: 1,
        chaptersAdded: result.chaptersAdded || 0,
        imagesUploaded: result.imagesUploaded || 0,
      };
      if (result.mode === "created") inc.created = 1;
      else if (result.mode === "updated") {
        if ((result.chaptersAdded || 0) > 0) inc.updated = 1;
        else inc.noop = 1;
      } else if (result.mode === "noop") inc.noop = 1;

      const itemStatus =
        result.mode === "created" ? "succeeded" :
        result.mode === "noop" ? "noop" :
        (result.mode === "updated" && (result.chaptersAdded || 0) === 0) ? "noop" :
        "succeeded";

      await ViHentaiAutoUpdateQueueModel.updateOne(
        { _id: queueId },
        {
          $inc: inc,
          $set: {
            "items.$[x].status": itemStatus,
            "items.$[x].mode": result.mode,
            "items.$[x].parsedTitle": result.parsedTitle,
            "items.$[x].mangaId": result.mangaId,
            "items.$[x].mangaSlug": result.mangaSlug,
            "items.$[x].chaptersAdded": result.chaptersAdded || 0,
            "items.$[x].imagesUploaded": result.imagesUploaded || 0,
            "items.$[x].message": result.message,
            "items.$[x].finishedAt": new Date(),
          },
        },
        { arrayFilters: [{ "x.index": index }] } as any,
      );

      if (itemStatus === "noop") consecutiveNoopOrFailed += 1;
      else consecutiveNoopOrFailed = 0;

      if (
        consecutiveNoopOrFailed >= STOP_AFTER_CONSECUTIVE_NOOP_OR_FAILED &&
        (await getViHentaiAutoUpdateStopEarlyEnabled())
      ) {
        await stopEarly(
          `Dừng sớm: ${STOP_AFTER_CONSECUTIVE_NOOP_OR_FAILED} truyện liên tiếp ở trạng thái noop/failed (mới nhất: #${index} ${url})`,
        );
        return;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await ViHentaiAutoUpdateQueueModel.updateOne(
        { _id: queueId },
        {
          $inc: { processed: 1 },
          $set: {
            "items.$[x].status": "failed",
            "items.$[x].mode": "failed",
            "items.$[x].message": message,
            "items.$[x].finishedAt": new Date(),
          },
          $push: { errors: { url, message } },
        },
        { arrayFilters: [{ "x.index": index }] } as any,
      );

      consecutiveNoopOrFailed += 1;
      if (
        consecutiveNoopOrFailed >= STOP_AFTER_CONSECUTIVE_NOOP_OR_FAILED &&
        (await getViHentaiAutoUpdateStopEarlyEnabled())
      ) {
        await stopEarly(
          `Dừng sớm: ${STOP_AFTER_CONSECUTIVE_NOOP_OR_FAILED} truyện liên tiếp ở trạng thái noop/failed (mới nhất: #${index} ${url})`,
        );
        return;
      }
    }

    // no delay between manga; HTML pacing is handled per request
  }

  await ViHentaiAutoUpdateQueueModel.updateOne(
    { _id: queueId },
    { $set: { status: "succeeded", finishedAt: new Date() } },
  );
};

let started = false;

export const initViHentaiAutoUpdateScheduler = (): void => {
  if (started) return;
  started = true;

  // Keep behavior consistent with other background tasks: run on exactly one instance.
  const isPrimary = process.env.LEADERBOARD_SCHEDULER === "1" || process.env.PORT === "3001";
  if (!isPrimary) return;

  // Best-effort: clear any leftover lock owned by this instance from a previous crash.
  void releaseLock();

  let running = false;
  const isMongoReady = () => mongoose.connection.readyState === 1;

  // 1) Every 30 minutes: extract 30 URLs into a new queue (status=queued).
  cron.schedule(
    "*/30 * * * *",
    async () => {
      if (running) return;
      running = true;
      try {
        if (!isMongoReady()) {
          console.warn("[cron] vi-hentai queue extract skipped: MongoDB not connected");
          return;
        }
        if (!(await getViHentaiAutoUpdateEnabled())) return;
        if (isVietnamBlackoutWindow()) {
          console.info("[cron] vi-hentai queue extract skipped: blackout window (VN 11:30-13:30, 21:30-00:30)");
          return;
        }
        const acquired = await tryAcquireLock(4 * 60 * 60 * 1000);
        if (!acquired) return;

        const r = await createViHentaiAutoUpdateQueue({
          listUrl: DEFAULT_LIST_URL,
          maxManga: DEFAULT_MAX_MANGA,
        });
        if (r.ok && r.queueId) {
          // Only start automatically if no other queue is currently running.
          const hasRunning = await ViHentaiAutoUpdateQueueModel.exists({ status: "running" });
          if (!hasRunning) {
            await startViHentaiAutoUpdateQueue(r.queueId);
            console.info(`[cron] vi-hentai queue extracted+started: queueId=${r.queueId}`);
          } else {
            console.info(`[cron] vi-hentai queue extracted (kept queued): queueId=${r.queueId}`);
          }
        } else {
          console.warn(`[cron] vi-hentai queue extract failed: ${r.message || "unknown"}`);
        }
      } catch (e) {
        console.error("[cron] vi-hentai queue extract failed", e);
      } finally {
        await releaseLock();
        running = false;
      }
    },
    { timezone: TZ },
  );

  // 2) Every minute: if there is a running queue, process it.
  cron.schedule(
    "*/1 * * * *",
    async () => {
      if (running) return;
      running = true;
      try {
        if (!isMongoReady()) {
          console.warn("[cron] vi-hentai queue worker skipped: MongoDB not connected");
          return;
        }
        if (!(await getViHentaiAutoUpdateEnabled())) return;
        if (isVietnamBlackoutWindow()) {
          console.info("[cron] vi-hentai queue worker skipped: blackout window (VN 11:30-13:30, 21:30-00:30)");
          return;
        }
        const acquired = await tryAcquireLock(4 * 60 * 60 * 1000);
        if (!acquired) return;

        // Prefer an existing running queue; otherwise promote the oldest queued queue.
        const qRunning = await ViHentaiAutoUpdateQueueModel.findOne({ status: "running" })
          .sort({ startedAt: 1, createdAt: 1 })
          .select({ _id: 1 })
          .lean();
        if (qRunning) {
          await processViHentaiAutoUpdateQueue(String((qRunning as any)._id));
          return;
        }

        const qQueued = await ViHentaiAutoUpdateQueueModel.findOneAndUpdate(
          { status: "queued" },
          { $set: { status: "running", startedAt: new Date() } },
          { sort: { createdAt: 1 }, new: true },
        ).select({ _id: 1 }).lean();
        if (!qQueued) return;

        await processViHentaiAutoUpdateQueue(String((qQueued as any)._id));
      } catch (e) {
        console.error("[cron] vi-hentai queue worker failed", e);
      } finally {
        await releaseLock();
        running = false;
      }
    },
    { timezone: TZ },
  );
};
