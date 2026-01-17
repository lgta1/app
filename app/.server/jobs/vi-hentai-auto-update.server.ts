import cron from "node-cron";
import { load } from "cheerio";

import { autoUpdateViHentaiManga } from "@/services/importers/vi-hentai-importer";
import { SystemLockModel } from "~/database/models/system-lock.model";
import { ViHentaiAutoUpdateRunModel } from "~/database/models/vi-hentai-auto-update-run.model";
import { MANGA_CONTENT_TYPE } from "~/constants/manga";

const TZ = "Asia/Ho_Chi_Minh";
const LOCK_KEY = "vi-hentai-auto-update";

// Pacing to reduce upstream rate-limits / 429.
const MANGA_DELAY_MS = 7_000;
// When auto-update starts, wait for any in-flight auto-download job to finish.
const WAIT_AUTO_DOWNLOAD_IDLE_TIMEOUT_MS = 25 * 60 * 1000;

const DEFAULT_LIST_URL = "https://vi-hentai.pro/danh-sach?page=1";
const DEFAULT_OWNER_ID = "68f0f839b69df690049aba65";

const getOwnerId = () => {
  const parts = [
    process.env.PM2_HOME ? "pm2" : undefined,
    process.env.NODE_APP_INSTANCE != null ? `inst:${process.env.NODE_APP_INSTANCE}` : undefined,
    `pid:${process.pid}`,
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
      $or: [{ lockedUntil: { $lte: now } }, { lockedUntil: { $exists: false } }],
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

export type RunViHentaiAutoUpdateOptions = {
  listUrl?: string;
  maxManga?: number;
  maxNewChaptersPerManga?: number;
  allowCreateNewManga?: boolean;
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
  options: RunViHentaiAutoUpdateOptions = {},
): Promise<{ ok: boolean; runId?: string; message?: string }> => {
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
      : Number.parseInt(String(process.env.VIHENTAI_AUTO_UPDATE_MAX_MANGA || "60"), 10) || 60;

  const maxNewChaptersPerManga =
    typeof options.maxNewChaptersPerManga === "number" && options.maxNewChaptersPerManga > 0
      ? options.maxNewChaptersPerManga
      : Number.parseInt(String(process.env.VIHENTAI_AUTO_UPDATE_MAX_NEW_CHAPTERS || "20"), 10) || 20;

  // Auto-update always allows creating new manga by default.
  // This prevents silently skipping new URLs and keeps behavior predictable.
  const allowCreateNewManga = true;

  const lockedBy = getOwnerId();

  // Avoid concurrency with auto-download batch.
  // If a job is already running, wait it out (best-effort) before hitting upstream.
  const idle = await waitForAutoDownloadIdle(WAIT_AUTO_DOWNLOAD_IDLE_TIMEOUT_MS);
  if (!idle) {
    return { ok: false, message: "Đang có batch tải truyện tự động chạy quá lâu; auto-update tạm hoãn" };
  }

  const run = await ViHentaiAutoUpdateRunModel.create({
    status: "running",
    listUrl: listUrl.toString(),
    startedAt: new Date(),
    lockedBy,
    processed: 0,
    created: 0,
    updated: 0,
    noop: 0,
    chaptersAdded: 0,
    imagesUploaded: 0,
    items: [],
    errors: [],
  });

  const ownerId = (options.ownerId || process.env.VIHENTAI_AUTO_UPDATE_OWNER_ID || DEFAULT_OWNER_ID).trim();
  if (allowCreateNewManga && ownerId && !isValidMongoObjectId(ownerId)) {
    await ViHentaiAutoUpdateRunModel.updateOne(
      { _id: run._id },
      {
        $set: {
          status: "failed",
          finishedAt: new Date(),
          errors: [{ url: listUrl.toString(), message: "ownerId không hợp lệ (cần Mongo ObjectId 24 ký tự hex)" }],
        },
      },
    );
    return { ok: false, runId: String(run._id), message: "ownerId không hợp lệ" };
  }
  if (allowCreateNewManga && !ownerId) {
    await ViHentaiAutoUpdateRunModel.updateOne(
      { _id: run._id },
      {
        $set: {
          status: "failed",
          finishedAt: new Date(),
          errors: [{ url: listUrl.toString(), message: "Thiếu ownerId để tạo truyện mới" }],
        },
      },
    );
    return { ok: false, runId: String(run._id), message: "Thiếu ownerId để tạo truyện mới" };
  }
  const translationTeam = (process.env.VIHENTAI_AUTO_UPDATE_TRANSLATION_TEAM || "").trim() || undefined;
  const envApproveRaw = process.env.VIHENTAI_AUTO_UPDATE_APPROVE;
  const envApprove =
    envApproveRaw != null && String(envApproveRaw).trim() !== ""
      ? String(envApproveRaw).trim() === "1"
      : undefined;
  const approveNewManga =
    typeof options.approveNewManga === "boolean" ? options.approveNewManga : (envApprove ?? true);
  const approve = allowCreateNewManga ? approveNewManga : false;
  const contentType =
    String(process.env.VIHENTAI_AUTO_UPDATE_CONTENT_TYPE || "MANGA").toUpperCase() === "COSPLAY"
      ? MANGA_CONTENT_TYPE.COSPLAY
      : MANGA_CONTENT_TYPE.MANGA;

  try {
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
      await ViHentaiAutoUpdateRunModel.updateOne(
        { _id: run._id },
        {
          $set: {
            status: "failed",
            finishedAt: new Date(),
            errors: [{ url: listUrl.toString(), message: `Không thể tải list (${res.status} ${res.statusText})` }],
          },
        },
      );
      return { ok: false, runId: String(run._id), message: "Không thể tải list page" };
    }

    const html = await res.text();
    const links = extractMangaLinksFromListingHtml(html, listUrl);

    if (links.length < maxManga) {
      await ViHentaiAutoUpdateRunModel.updateOne(
        { _id: run._id },
        {
          $push: {
            errors: {
              url: listUrl.toString(),
              message: `Chỉ lấy được ${links.length} URL từ list (cần ${maxManga}). Có thể upstream thay đổi HTML hoặc thiếu dữ liệu.`,
            },
          },
        },
      );
    }

    const selected = links.slice(0, Math.max(1, maxManga));

    const errors: Array<{ url: string; message: string }> = [];

    for (let i = 0; i < selected.length; i += 1) {
      const mangaUrl = selected[i];
      const index = i + 1;

      await ViHentaiAutoUpdateRunModel.updateOne(
        { _id: run._id },
        {
          $push: {
            items: {
              index,
              url: mangaUrl,
              status: "running",
              startedAt: new Date(),
            },
          },
        },
      );

      try {
        const u = new URL(mangaUrl);
        if (!isAllowedHost(u.hostname)) {
          throw new Error("Manga URL không thuộc vi-hentai.pro");
        }
      } catch {
        // ignore URL parse errors; will be caught by update
      }

      try {
        const result = await autoUpdateViHentaiManga({
          request: new Request("http://internal/vi-hentai-auto-update"),
          url: mangaUrl,
          // For existing manga, ownerId is not required.
          ownerId: allowCreateNewManga ? ownerId : undefined,
          translationTeam,
          approve,
          contentType,
          asSystem: true,
          downloadPoster: true,
          downloadChapters: true,
          maxNewChapters: maxNewChaptersPerManga,
          maxChaptersForNewManga: 200,
          // pacing (as requested)
          imageDelayMs: 1_000,
          chapterDelayMs: 3_000,
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

        await ViHentaiAutoUpdateRunModel.updateOne(
          { _id: run._id },
          {
            $inc: inc,
            $set: {
              "items.$[it].status": itemStatus,
              "items.$[it].mode": result.mode,
              "items.$[it].parsedTitle": result.parsedTitle,
              "items.$[it].mangaId": result.mangaId,
              "items.$[it].mangaSlug": result.mangaSlug,
              "items.$[it].chaptersAdded": result.chaptersAdded || 0,
              "items.$[it].imagesUploaded": result.imagesUploaded || 0,
              "items.$[it].message": result.message,
              "items.$[it].finishedAt": new Date(),
            },
          },
          { arrayFilters: [{ "it.index": index }] } as any,
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push({ url: mangaUrl, message });

          await ViHentaiAutoUpdateRunModel.updateOne(
            { _id: run._id },
            {
              $inc: { processed: 1 },
              $set: {
                "items.$[it].status": "failed",
                "items.$[it].mode": "failed",
                "items.$[it].message": message,
                "items.$[it].finishedAt": new Date(),
              },
            },
            { arrayFilters: [{ "it.index": index }] } as any,
          );

          // Keep errors bounded
          if (errors.length <= 50) {
            await ViHentaiAutoUpdateRunModel.updateOne(
              { _id: run._id },
              { $push: { errors: { url: mangaUrl, message } } },
            );
          }
      }

      // Delay between manga to reduce too-many-requests.
      if (i < selected.length - 1 && MANGA_DELAY_MS > 0) {
        await sleep(MANGA_DELAY_MS);
      }
    }

    // Run-level status: mark as succeeded when the batch completes.
    // Item-level failures are tracked in `items` + `errors`.
    const finalStatus = "succeeded";
    await ViHentaiAutoUpdateRunModel.updateOne(
      { _id: run._id },
      { $set: { status: finalStatus, finishedAt: new Date() } },
    );

    return { ok: true, runId: String(run._id) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await ViHentaiAutoUpdateRunModel.updateOne(
      { _id: run._id },
      { $set: { status: "failed", finishedAt: new Date() }, $push: { errors: { url: listUrl.toString(), message } } },
    );
    return { ok: false, runId: String(run._id), message };
  }
};

let started = false;

export const initViHentaiAutoUpdateScheduler = (): void => {
  if (started) return;
  started = true;

  // Keep behavior consistent with other background tasks: run on exactly one instance.
  const isPrimary = process.env.LEADERBOARD_SCHEDULER === "1" || process.env.PORT === "3001";
  if (!isPrimary) return;

  let running = false;

  cron.schedule(
    "0 * * * *",
    async () => {
      if (running) return;
      running = true;
      try {
        const acquired = await tryAcquireLock(29 * 60 * 1000);
        if (!acquired) return;

        const r = await runViHentaiAutoUpdateOnce();
        if (r.ok) console.info(`[cron] vi-hentai auto-update done: runId=${r.runId}`);
        else console.warn(`[cron] vi-hentai auto-update skipped/failed: ${r.message || "unknown"}`);
      } catch (e) {
        console.error("[cron] vi-hentai auto-update failed", e);
      } finally {
        running = false;
      }
    },
    { timezone: TZ },
  );
};
