import { ViHentaiAutoDownloadJobModel, type ViHentaiAutoDownloadJobProgress } from "~/database/models/vi-hentai-auto-download-job.model";
import { autoDownloadViHentaiManga } from "@/services/importers/vi-hentai-importer";
import { MANGA_CONTENT_TYPE } from "~/constants/manga";
import { SystemLockModel } from "~/database/models/system-lock.model";

const AUTO_UPDATE_LOCK_KEY = "vi-hentai-auto-update";

// If a running job stops updating heartbeat (process crash / hung IO), it can block the whole queue forever.
// Auto-fail it after a grace period so the worker can continue.
const STALE_HEARTBEAT_MS = 15 * 60 * 1000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const abortControllersByJobId = new Map<string, AbortController>();

export const requestAbortViHentaiAutoDownloadJob = (jobId: string): boolean => {
  const ac = abortControllersByJobId.get(String(jobId));
  if (!ac) return false;
  try {
    ac.abort();
  } catch {
    // ignore
  }
  return true;
};

export const requestAbortViHentaiAutoDownloadBatch = async (batchId: string): Promise<number> => {
  const running = await ViHentaiAutoDownloadJobModel.find({ batchId, status: "running" })
    .select({ _id: 1 })
    .lean();
  let n = 0;
  for (const j of running) {
    if (requestAbortViHentaiAutoDownloadJob(String((j as any)._id))) n += 1;
  }
  return n;
};

async function isAutoUpdateActive(): Promise<boolean> {
  const now = new Date();
  const lock = await SystemLockModel.findOne({ key: AUTO_UPDATE_LOCK_KEY, lockedUntil: { $gt: now } })
    .select({ _id: 1 })
    .lean();
  return Boolean(lock);
}

let started = false;
let busy = false;

export const initViHentaiAutoDownloadQueueWorker = (): void => {
  if (started) return;
  started = true;

  // Only allow a single instance to run background jobs.
  // Reuse the existing knob in ecosystem.config.cjs.
  const isPrimary = process.env.LEADERBOARD_SCHEDULER === "1";
  if (!isPrimary) return;

  // eslint-disable-next-line no-console
  console.info("[vi-hentai-queue] worker initialized");

  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await processOneJob();
    } finally {
      busy = false;
    }
  };

  // Fast-ish polling; UI progress polling is 5s, so 3s tick is enough.
  setInterval(() => {
    void tick();
  }, 3_000);

  // Kick once immediately.
  void tick();
};

async function processOneJob(): Promise<void> {
  // If auto-update is running, don't start auto-download jobs.
  // This reduces concurrent upstream requests (429 / too-many-requests).
  if (await isAutoUpdateActive()) return;

  // Safety: if there is already a running job, don't start another.
  // Self-heal: if that running job has a stale heartbeat, mark it failed to unblock the queue.
  const now = new Date();
  const running = await ViHentaiAutoDownloadJobModel.findOne({ status: "running" })
    .select({ _id: 1, url: 1, startedAt: 1, lastHeartbeatAt: 1 })
    .lean();
  if (running) {
    const hb = (running as any).lastHeartbeatAt ? new Date((running as any).lastHeartbeatAt) : null;
    const hbAgeMs = hb ? now.getTime() - hb.getTime() : Number.POSITIVE_INFINITY;
    if (hbAgeMs > STALE_HEARTBEAT_MS) {
      const url = String((running as any).url || "");
      console.warn(
        `[vi-hentai-queue] stale running job detected; auto-failing to unblock queue: jobId=${String((running as any)._id)} url=${url} heartbeatAgeMs=${Math.round(hbAgeMs)}`,
      );
      await ViHentaiAutoDownloadJobModel.updateOne(
        { _id: (running as any)._id, status: "running" },
        {
          $set: {
            status: "failed",
            finishedAt: now,
            lastHeartbeatAt: now,
            errorMessage: `Stale heartbeat: job stuck without progress for ${Math.round(hbAgeMs / 1000)}s; auto-failed to unblock queue`,
            progress: { stage: "done", message: "Lỗi (stale heartbeat)", updatedAt: now },
          },
        },
      );
    }
    return;
  }

  const job = await ViHentaiAutoDownloadJobModel.findOneAndUpdate(
    {
      status: "queued",
      paused: { $ne: true },
      cancelRequestedAt: { $exists: false },
      hardDeleteRequestedAt: { $exists: false },
    },
    {
      $set: {
        status: "running",
        startedAt: new Date(),
        lastHeartbeatAt: new Date(),
        progress: { stage: "manga", message: "Đang bắt đầu...", updatedAt: new Date() },
      },
      $unset: { finishedAt: 1, errorMessage: 1, result: 1 },
    },
    { sort: { createdAt: 1 }, new: true },
  ).lean();

  if (!job) return;

  // Throttle DB writes from per-image progress.
  let lastPersistAt = 0;
  const persistProgress = async (progress: ViHentaiAutoDownloadJobProgress) => {
    const now = Date.now();
    const hasMangaInfo = Boolean((progress as any).mangaId || (progress as any).mangaSlug);
    if (!hasMangaInfo && now - lastPersistAt < 1200) return;
    lastPersistAt = now;

    const set: any = {
      progress: { ...progress, updatedAt: new Date() },
      lastHeartbeatAt: new Date(),
    };
    if ((progress as any).mangaId) set.createdMangaId = String((progress as any).mangaId);
    if ((progress as any).mangaSlug) set.createdMangaSlug = String((progress as any).mangaSlug);

    await ViHentaiAutoDownloadJobModel.updateOne({ _id: job._id }, { $set: set });
  };

  const jobId = String((job as any)._id);
  const abortController = new AbortController();
  abortControllersByJobId.set(jobId, abortController);

  // Poll DB for cancel/hard-delete signals to abort even if the request hit another instance.
  const cancelPoll = setInterval(() => {
    void (async () => {
      try {
        const doc = await ViHentaiAutoDownloadJobModel.findById(jobId)
          .select({ cancelRequestedAt: 1, hardDeleteRequestedAt: 1 })
          .lean();
        if ((doc as any)?.cancelRequestedAt || (doc as any)?.hardDeleteRequestedAt) {
          abortController.abort();
        }
      } catch {
        // ignore
      }
    })();
  }, 500);

  try {
    const contentType = job.contentType === "COSPLAY" ? MANGA_CONTENT_TYPE.COSPLAY : MANGA_CONTENT_TYPE.MANGA;
    const userStatusValue = job.userStatus;
    const userStatusOverride = userStatusValue === "completed" ? 1 : userStatusValue === "ongoing" ? 0 : undefined;

    const result = await autoDownloadViHentaiManga({
      request: new Request("http://internal/vi-hentai-worker"),
      url: job.url,
      ownerId: job.ownerId,
      translationTeam: job.translationTeam || undefined,
      approve: Boolean(job.approve),
      dryRun: Boolean(job.dryRun),
      skipIfExists: job.skipIfExists !== false,
      contentType,
      userStatusOverride,
      downloadPoster: job.downloadPoster !== false,
      downloadChapters: true,
      asSystem: true,
      maxChapters: typeof job.maxChapters === "number" && job.maxChapters > 0 ? job.maxChapters : 200,
      // importer already has pacing/retry defaults
      abortSignal: abortController.signal,
      onProgress: async (p: ViHentaiAutoDownloadJobProgress) => {
        try {
          await persistProgress(p);
        } catch {
          // Never fail the job due to progress write.
        }
      },
    } as any);

    await ViHentaiAutoDownloadJobModel.updateOne(
      { _id: job._id },
      {
        $set: {
          status: "succeeded",
          finishedAt: new Date(),
          lastHeartbeatAt: new Date(),
          progress: { stage: "done", message: "Hoàn thành", updatedAt: new Date() },
          result: {
            message: result.message,
            createdId: result.createdId,
            createdSlug: result.createdSlug,
            chaptersImported: result.chaptersImported,
            imagesUploaded: result.imagesUploaded,
            bytesSaved: result.bytesSaved,
            chapterErrors: Array.isArray(result.chapterErrors) ? result.chapterErrors.length : 0,
          },
        },
        $unset: { errorMessage: 1 },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await ViHentaiAutoDownloadJobModel.updateOne(
      { _id: job._id },
      {
        $set: {
          status: "failed",
          finishedAt: new Date(),
          lastHeartbeatAt: new Date(),
          errorMessage: message,
          progress: { stage: "done", message: "Lỗi", updatedAt: new Date() },
        },
      },
    );
  } finally {
    try {
      clearInterval(cancelPoll);
    } catch {
      // ignore
    }
    abortControllersByJobId.delete(jobId);
    // Cooldown between manga jobs (server pacing)
    await sleep(7_000);
  }
}
