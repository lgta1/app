import { initMongoDB } from "~/database/connection";
import { SystemLockModel } from "~/database/models/system-lock.model";
import { ViHentaiAutoDownloadJobModel } from "~/database/models/vi-hentai-auto-download-job.model";
import { ViHentaiAutoUpdateQueueModel } from "~/database/models/vi-hentai-auto-update-queue.model";

const LOCK_KEY = "vi-hentai-auto-update";

async function main() {
  initMongoDB();

  const now = new Date();
  const lock = await SystemLockModel.findOne({ key: LOCK_KEY }).lean();

  const downloadRunning = await ViHentaiAutoDownloadJobModel.findOne({ status: "running" })
    .select({ _id: 1, url: 1, startedAt: 1, lastHeartbeatAt: 1, progress: 1 })
    .lean();

  const downloadCounts = await ViHentaiAutoDownloadJobModel.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const updateCounts = await ViHentaiAutoUpdateQueueModel.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const updateRunning = await ViHentaiAutoUpdateQueueModel.findOne({ status: "running" })
    .select({ _id: 1, listUrl: 1, startedAt: 1, finishedAt: 1 })
    .lean();

  console.log(
    JSON.stringify(
      {
        now,
        lock: lock
          ? {
              key: (lock as any).key,
              lockedUntil: (lock as any).lockedUntil,
              lockedBy: (lock as any).lockedBy,
              isActive: (lock as any).lockedUntil ? new Date((lock as any).lockedUntil).getTime() > now.getTime() : false,
            }
          : null,
        autoDownload: {
          counts: downloadCounts,
          running: downloadRunning,
        },
        autoUpdate: {
          counts: updateCounts,
          running: updateRunning,
        },
      },
      null,
      2,
    ),
  );

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
