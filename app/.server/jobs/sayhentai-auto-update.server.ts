import cron from "node-cron";
import mongoose from "mongoose";
import os from "node:os";

import { importChapterFromSourceUrl } from "@/services/importers/vi-hentai-importer";
import { AutoUpdateSayHentaiService } from "@/services/auto-update-sayhentai.service";
import { SystemLockModel } from "~/database/models/system-lock.model";
import { SayHentaiAutoUpdateQueueModel } from "~/database/models/say-hentai-auto-update-queue.model";
import { SayHentaiAutoUpdateMangaModel } from "~/database/models/say-hentai-auto-update-manga.model";
import { MangaModel } from "~/database/models/manga.model";
import { ChapterModel } from "~/database/models/chapter.model";
import { getFeatureFlag, setFeatureFlag } from "~/.server/services/system-feature-flag.server";

const TZ = "Europe/Paris";
const VN_TZ = "Asia/Ho_Chi_Minh";
const LOCK_KEY = "sayhentai-auto-update";

const DEFAULT_OWNER_ID = "68f0f839b69df690049aba65";

const FEATURE_FLAG_KEY = "sayHentaiAutoUpdateEnabled";
const DEFAULT_ENABLED = true;

export const getSayHentaiAutoUpdateEnabled = async (): Promise<boolean> => {
  return getFeatureFlag(FEATURE_FLAG_KEY, DEFAULT_ENABLED);
};

export const setSayHentaiAutoUpdateEnabled = async (enabled: boolean): Promise<boolean> => {
  return setFeatureFlag(FEATURE_FLAG_KEY, enabled);
};

const getOwnerId = () => {
  const parts = [
    process.env.PM2_HOME ? "pm2" : "node",
    process.env.NODE_APP_INSTANCE != null ? `inst:${process.env.NODE_APP_INSTANCE}` : undefined,
    process.env.PORT ? `port:${process.env.PORT}` : undefined,
    `host:${os.hostname()}`,
  ].filter(Boolean);
  return parts.join("|");
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

const normalizeSayPath = (raw: string, origin: string): string | null => {
  return AutoUpdateSayHentaiService.normalizeMangaPath(raw, origin);
};

const normalizeVinaPath = (raw: string): string | null => {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed, "https://vinahentai.local");
    const pathname = url.pathname.replace(/\/+$/, "");
    if (!pathname.startsWith("/")) return null;
    if (/^\/truyen-hentai\//i.test(pathname) || /^\/truyen\//i.test(pathname)) return pathname;
    const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
    return `/truyen-hentai/${normalized.replace(/^\//, "")}`;
  } catch {
    const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    if (/^\/truyen-hentai\//i.test(normalized) || /^\/truyen\//i.test(normalized)) {
      return normalized.replace(/\/+$/, "");
    }
    const slug = normalized.replace(/^\//, "");
    if (!slug) return null;
    return `/truyen-hentai/${slug}`;
  }
};

const extractVinaSlug = (vinaPath: string): string => {
  const normalized = vinaPath.replace(/\/+$/, "");
  if (/^\/truyen-hentai\//i.test(normalized)) {
    return normalized.replace(/^\/truyen-hentai\//i, "");
  }
  if (/^\/truyen\//i.test(normalized)) {
    return normalized.replace(/^\/truyen\//i, "");
  }
  return normalized.replace(/^\//, "");
};

const isValidObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value.trim());

const findMangaByVinaPath = async (vinaPath: string) => {
  const slug = extractVinaSlug(vinaPath);
  if (!slug) return null;
  const manga = await MangaModel.findOne({ slug })
    .select({ _id: 1, slug: 1, chapters: 1 })
    .lean();
  if (manga) return manga as any;
  if (isValidObjectId(slug)) {
    return MangaModel.findById(slug)
      .select({ _id: 1, slug: 1, chapters: 1 })
      .lean();
  }
  return null;
};

const buildSayChapterUrl = (origin: string, sayPath: string, chapterNumber: number): string => {
  const base = sayPath.replace(/\.html$/i, "").replace(/\/+$/, "");
  return `${origin}${base}/chuong-${chapterNumber}`;
};

const extractHttpStatus = (message: string): number | null => {
  const match = String(message || "").match(/\((\d{3})\s/);
  if (!match?.[1]) return null;
  const status = Number.parseInt(match[1], 10);
  return Number.isFinite(status) ? status : null;
};

const randomUpdatedAtAgo = () => {
  const now = new Date();
  const hoursAgoOptions = [10, 13, 16];
  const hoursAgo = hoursAgoOptions[Math.floor(Math.random() * hoursAgoOptions.length)];
  return new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
};

export type CreateSayHentaiAutoUpdateQueueOptions = {
  maxNewChaptersPerManga?: number;
  ownerId?: string;
  approveNewManga?: boolean;
};

const DEFAULT_MAX_NEW_CHAPTERS = 100;
const WAIT_AUTO_DOWNLOAD_IDLE_TIMEOUT_MS = 25 * 60 * 1000;

export const createSayHentaiAutoUpdateQueue = async (
  options: CreateSayHentaiAutoUpdateQueueOptions = {},
): Promise<{ ok: boolean; queueId?: string; message?: string }> => {
  if (!(await getSayHentaiAutoUpdateEnabled())) {
    return { ok: false, message: "Auto-update is disabled" };
  }

  const config = await AutoUpdateSayHentaiService.getConfig();
  if (!config?.origin) {
    return { ok: false, message: "Missing sayhentai domain" };
  }

  const listUrl = `${config.origin.replace(/\/+$/, "")}/?page=1`;

  const allowlistDocs = await SayHentaiAutoUpdateMangaModel.find({})
    .select({ sayPath: 1, vinaPath: 1, path: 1 })
    .lean();
  const allowMap = new Map<string, { sayPath: string; vinaPath?: string | null }>();

  for (const doc of allowlistDocs as any[]) {
    const rawSay = String((doc as any).sayPath || (doc as any).path || "");
    const sayPath = normalizeSayPath(rawSay, config.origin);
    if (!sayPath) continue;
    const vinaPath = normalizeVinaPath(String((doc as any).vinaPath || ""));
    allowMap.set(sayPath, { sayPath, vinaPath });
  }

  if (!allowMap.size) {
    return { ok: false, message: "Allowlist is empty" };
  }

  const matched: Array<{ url: string; sayPath: string; vinaPath?: string | null }> = [];
  for (const allow of allowMap.values()) {
    const url = `${config.origin.replace(/\/+$/, "")}${allow.sayPath}`;
    matched.push({ url, sayPath: allow.sayPath, vinaPath: allow.vinaPath });
  }

  const maxNewChaptersPerManga =
    typeof options.maxNewChaptersPerManga === "number" && options.maxNewChaptersPerManga > 0
      ? options.maxNewChaptersPerManga
      : Number.parseInt(String(process.env.SAYHENTAI_AUTO_UPDATE_MAX_NEW_CHAPTERS || ""), 10) ||
        DEFAULT_MAX_NEW_CHAPTERS;

  const ownerId = (options.ownerId || process.env.SAYHENTAI_AUTO_UPDATE_OWNER_ID || DEFAULT_OWNER_ID).trim();
  const approveNewMangaRaw = process.env.SAYHENTAI_AUTO_UPDATE_APPROVE;
  const approveNewManga =
    typeof options.approveNewManga === "boolean"
      ? options.approveNewManga
      : approveNewMangaRaw != null && String(approveNewMangaRaw).trim() !== ""
        ? String(approveNewMangaRaw).trim() === "1"
        : true;

  const lockedBy = getOwnerId();
  const queue = await SayHentaiAutoUpdateQueueModel.create({
    status: "queued",
    listUrl,
    domain: config.domain,
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
    items: matched.map((entry, idx) => ({
      index: idx + 1,
      url: entry.url,
      sayPath: entry.sayPath,
      vinaPath: entry.vinaPath || undefined,
      status: "queued",
    })),
    errors: [],
  });

  return { ok: true, queueId: String((queue as any)._id) };
};

export const startSayHentaiAutoUpdateQueue = async (
  queueId: string,
  options: { manual?: boolean } = {},
): Promise<boolean> => {
  if (!queueId) return false;
  if (!(await getSayHentaiAutoUpdateEnabled())) return false;

  const otherRunning = await SayHentaiAutoUpdateQueueModel.exists({ status: "running", _id: { $ne: queueId } });
  if (otherRunning) return false;

  const res = await SayHentaiAutoUpdateQueueModel.updateOne(
    { _id: queueId, status: { $in: ["queued", "failed"] } },
    { $set: { status: "running", startedAt: new Date(), manualOverride: Boolean(options.manual) } },
  );
  return Boolean((res as any).modifiedCount || (res as any).nModified);
};

export const kickSayHentaiAutoUpdateQueue = async (
  queueId: string,
): Promise<{ ok: boolean; message?: string }> => {
  if (!queueId) return { ok: false, message: "Missing queueId" };
  if (!(await getSayHentaiAutoUpdateEnabled())) return { ok: false, message: "Auto-update is disabled" };

  const queue = await SayHentaiAutoUpdateQueueModel.findById(queueId)
    .select({ _id: 1, status: 1 })
    .lean();
  if (!queue) return { ok: false, message: "Queue not found" };

  if (String((queue as any).status) !== "running") {
    await SayHentaiAutoUpdateQueueModel.updateOne(
      { _id: queueId },
      { $set: { status: "running", startedAt: new Date(), manualOverride: true } },
    );
  }

  void (async () => {
    const acquired = await tryAcquireLock(4 * 60 * 60 * 1000);
    if (!acquired) return;
    try {
      await processSayHentaiAutoUpdateQueue(queueId);
    } finally {
      await releaseLock();
    }
  })();

  return { ok: true };
};

const processSayHentaiAutoUpdateQueue = async (queueId: string): Promise<void> => {
  if (!(await getSayHentaiAutoUpdateEnabled())) return;
  const queue = await SayHentaiAutoUpdateQueueModel.findById(queueId).lean();
  if (!queue) return;
  if ((queue as any).status !== "running") return;

  const ensureQueueStillRunning = async (): Promise<boolean> => {
    const fresh = await SayHentaiAutoUpdateQueueModel.findById(queueId)
      .select({ status: 1 })
      .lean();
    return Boolean(fresh && (fresh as any).status === "running");
  };

  const idle = await waitForAutoDownloadIdle(WAIT_AUTO_DOWNLOAD_IDLE_TIMEOUT_MS);
  if (!idle) {
    await SayHentaiAutoUpdateQueueModel.updateOne(
      { _id: queueId },
      {
        $set: { status: "failed", finishedAt: new Date() },
        $push: {
          errors: {
            url: String((queue as any).listUrl || ""),
            message: "Auto-download is busy; queue paused",
          },
        },
      },
    );
    return;
  }

  const maxNewChaptersPerManga = Number((queue as any).maxNewChaptersPerManga || DEFAULT_MAX_NEW_CHAPTERS);
  const listOrigin = (() => {
    try {
      return new URL(String((queue as any).listUrl || "")).origin;
    } catch {
      return "";
    }
  })();

  const items: any[] = Array.isArray((queue as any).items) ? (queue as any).items : [];

  for (let i = 0; i < items.length; i += 1) {
    if (!(await ensureQueueStillRunning())) return;
    if (!(await getSayHentaiAutoUpdateEnabled())) return;

    const it = items[i];
    const index = Number(it.index || i + 1);
    const url = String(it.url || "").trim();

    if (it.status === "succeeded") continue;
    if (it.status === "noop") continue;

    await SayHentaiAutoUpdateQueueModel.updateOne(
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
      if (!listOrigin) {
        throw new Error("Missing sayhentai origin");
      }

      const sayPath = String(it.sayPath || "").trim() || normalizeSayPath(url, listOrigin) || "";
      const vinaPath = normalizeVinaPath(String(it.vinaPath || ""));

      if (!sayPath) {
        throw new Error("Missing sayhentai path");
      }
      if (!vinaPath) {
        await SayHentaiAutoUpdateQueueModel.updateOne(
          { _id: queueId },
          {
            $inc: { processed: 1, noop: 1 },
            $set: {
              "items.$[x].status": "noop",
              "items.$[x].mode": "noop",
              "items.$[x].message": "Missing vinahentai path (mapping required)",
              "items.$[x].finishedAt": new Date(),
            },
          },
          { arrayFilters: [{ "x.index": index }] } as any,
        );
        continue;
      }

      const manga = await findMangaByVinaPath(vinaPath);
      if (!manga) {
        throw new Error(`Manga not found for vinahentai path: ${vinaPath}`);
      }

      const lastChapter = await ChapterModel.findOne({ mangaId: String((manga as any)._id) })
        .sort({ chapterNumber: -1 })
        .select({ chapterNumber: 1 })
        .lean();
      let nextChapterNumber = Number((lastChapter as any)?.chapterNumber || 0) + 1;

      let chaptersAdded = 0;
      let imagesUploaded = 0;
      let stopReason = "";

      for (let step = 0; step < maxNewChaptersPerManga; step += 1) {
        const chapterUrl = buildSayChapterUrl(listOrigin, sayPath, nextChapterNumber);
        try {
          const result = await importChapterFromSourceUrl({
            request: new Request("http://internal/sayhentai-auto-update-queue"),
            mangaId: String((manga as any)._id),
            chapterTitle: `Chuong ${nextChapterNumber}`,
            chapterUrl,
            chapterNumberForPath: nextChapterNumber,
            asSystem: true,
            imageDelayMs: 100,
            imageTimeoutMs: 30_000,
            imageRetries: 2,
            maxImagesPerChapter: 300,
          });
          chaptersAdded += 1;
          imagesUploaded += result.imagesUploaded || 0;
          nextChapterNumber += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const status = extractHttpStatus(message);
          if (status === 404) {
            stopReason = `Stop at 404: ${chapterUrl}`;
            break;
          }
          throw err;
        }
      }

      const isNoop = chaptersAdded === 0;
      const inc: any = {
        processed: 1,
        chaptersAdded,
        imagesUploaded,
      };
      if (isNoop) inc.noop = 1;
      else inc.updated = 1;

      const message = isNoop ? stopReason || "No new chapters" : `Added ${chaptersAdded} chapters`;

      await SayHentaiAutoUpdateQueueModel.updateOne(
        { _id: queueId },
        {
          $inc: inc,
          $set: {
            "items.$[x].status": isNoop ? "noop" : "succeeded",
            "items.$[x].mode": isNoop ? "noop" : "updated",
            "items.$[x].parsedTitle": String((manga as any).slug || ""),
            "items.$[x].mangaId": String((manga as any)._id),
            "items.$[x].mangaSlug": String((manga as any).slug || (manga as any)._id),
            "items.$[x].chaptersAdded": chaptersAdded,
            "items.$[x].imagesUploaded": imagesUploaded,
            "items.$[x].message": message,
            "items.$[x].finishedAt": new Date(),
          },
        },
        { arrayFilters: [{ "x.index": index }] } as any,
      );

      if (!isNoop && chaptersAdded > 0) {
        const updatedAt = randomUpdatedAtAgo();
        await MangaModel.updateOne(
          { _id: String((manga as any)._id) },
          { $set: { updatedAt } },
          { timestamps: false },
        );
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await SayHentaiAutoUpdateQueueModel.updateOne(
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
    }

    await sleep(60_000);
  }

  await SayHentaiAutoUpdateQueueModel.updateOne(
    { _id: queueId },
    { $set: { status: "succeeded", finishedAt: new Date() } },
  );
};

export const runSayHentaiAutoUpdateOnce = async (): Promise<{ ok: boolean; runId?: string; message?: string }> => {
  if (!(await getSayHentaiAutoUpdateEnabled())) {
    return { ok: false, message: "Auto-update is disabled" };
  }

  const createdQueue = await createSayHentaiAutoUpdateQueue();
  if (!createdQueue.ok || !createdQueue.queueId) return { ok: false, message: createdQueue.message };

  await SayHentaiAutoUpdateQueueModel.updateOne(
    { _id: createdQueue.queueId },
    { $set: { status: "running", startedAt: new Date(), lockedBy: getOwnerId(), manualOverride: true } },
  );

  return { ok: true, runId: createdQueue.queueId };
};

let started = false;

export const initSayHentaiAutoUpdateScheduler = (): void => {
  if (started) return;
  started = true;

  const isPrimary = process.env.LEADERBOARD_SCHEDULER === "1" || process.env.PORT === "3001";
  if (!isPrimary) return;

  void releaseLock();

  let running = false;
  const isMongoReady = () => mongoose.connection.readyState === 1;

  cron.schedule(
    "0 3 * * *",
    async () => {
      if (running) return;
      running = true;
      try {
        if (!isMongoReady()) return;
        if (!(await getSayHentaiAutoUpdateEnabled())) return;
        const acquired = await tryAcquireLock(4 * 60 * 60 * 1000);
        if (!acquired) return;

        const qRunning = await SayHentaiAutoUpdateQueueModel.findOne({ status: "running" })
          .sort({ startedAt: 1, createdAt: 1 })
          .select({ _id: 1 })
          .lean();
        if (qRunning) {
          await processSayHentaiAutoUpdateQueue(String((qRunning as any)._id));
          return;
        }

        const created = await createSayHentaiAutoUpdateQueue();
        if (!created.ok || !created.queueId) return;

        await SayHentaiAutoUpdateQueueModel.updateOne(
          { _id: created.queueId },
          { $set: { status: "running", startedAt: new Date(), lockedBy: getOwnerId() } },
        );

        await processSayHentaiAutoUpdateQueue(String(created.queueId));
      } catch {
        // ignore
      } finally {
        await releaseLock();
        running = false;
      }
    },
    { timezone: VN_TZ },
  );
};
