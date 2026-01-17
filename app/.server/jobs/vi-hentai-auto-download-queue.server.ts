import { ViHentaiAutoDownloadJobModel, type ViHentaiAutoDownloadJobProgress } from "~/database/models/vi-hentai-auto-download-job.model";
import { autoDownloadViHentaiManga } from "@/services/importers/vi-hentai-importer";
import { MANGA_CONTENT_TYPE } from "~/constants/manga";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
  // Safety: if there is already a running job, don't start another.
  const running = await ViHentaiAutoDownloadJobModel.findOne({ status: "running" })
    .select({ _id: 1 })
    .lean();
  if (running) return;

  const job = await ViHentaiAutoDownloadJobModel.findOneAndUpdate(
    { status: "queued", paused: { $ne: true } },
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
    if (now - lastPersistAt < 1200) return;
    lastPersistAt = now;

    await ViHentaiAutoDownloadJobModel.updateOne(
      { _id: job._id },
      {
        $set: {
          progress: { ...progress, updatedAt: new Date() },
          lastHeartbeatAt: new Date(),
        },
      },
    );
  };

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
      onProgress: async (p) => {
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
    // Cooldown between manga jobs (server pacing)
    await sleep(7_000);
  }
}
