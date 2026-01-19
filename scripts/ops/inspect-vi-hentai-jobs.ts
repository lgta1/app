import { initMongoDB } from "~/database/connection";
import { SystemLockModel } from "~/database/models/system-lock.model";
import { ViHentaiAutoDownloadJobModel } from "~/database/models/vi-hentai-auto-download-job.model";
import { ViHentaiAutoUpdateQueueModel } from "~/database/models/vi-hentai-auto-update-queue.model";
import mongoose from "mongoose";

const LOCK_KEY = "vi-hentai-auto-update";

const waitForMongoConnected = async (timeoutMs: number) => {
  if (mongoose.connection.readyState === 1) return;

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      cleanup();
      reject(new Error(`MongoDB connection timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const onConnected = () => {
      cleanup();
      resolve();
    };
    const onError = (err: unknown) => {
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    const cleanup = () => {
      clearTimeout(t);
      mongoose.connection.off("connected", onConnected);
      mongoose.connection.off("error", onError);
    };

    mongoose.connection.on("connected", onConnected);
    mongoose.connection.on("error", onError);
  });
};

async function main() {
  initMongoDB();
  await waitForMongoConnected(15_000);

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

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
