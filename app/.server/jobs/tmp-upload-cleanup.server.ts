import cron from "node-cron";
import mongoose from "mongoose";

import { deletePublicFiles, getEnvironmentPrefix, listPublicFiles } from "~/utils/minio.utils";
import { SystemLockModel } from "~/database/models/system-lock.model";

const TZ = "Asia/Ho_Chi_Minh";
const LOCK_KEY = "tmp-upload-cleanup";
const TMP_PREFIX = "tmp/manga-images";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

const getOwnerId = () => {
  const parts = [
    process.env.PM2_HOME ? "pm2" : undefined,
    process.env.NODE_APP_INSTANCE != null ? `inst:${process.env.NODE_APP_INSTANCE}` : undefined,
    `pid:${process.pid}`,
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

export const initTmpUploadCleanupScheduler = (): void => {
  const isPrimaryInstance = process.env.TMP_UPLOAD_CLEANUP_SCHEDULER === "1";

  if (!isPrimaryInstance) return;

  let running = false;
  const isMongoReady = () => mongoose.connection.readyState === 1;

  cron.schedule(
    "0 5 * * *",
    async () => {
      if (running) return;
      if (!isMongoReady()) {
        console.warn("[cron] tmp upload cleanup skipped: MongoDB not connected");
        return;
      }

      running = true;
      try {
        const acquired = await tryAcquireLock(25 * 60 * 1000);
        if (!acquired) return;

        const envPrefix = getEnvironmentPrefix();
        const listPrefix = envPrefix ? `${envPrefix}/${TMP_PREFIX}` : TMP_PREFIX;

        const files = await listPublicFiles({ prefixPath: listPrefix, recursive: true });
        if (!files.length) return;

        const now = Date.now();
        const stale = files.filter((file) => {
          const last = file.lastModified instanceof Date ? file.lastModified.getTime() : 0;
          return last > 0 && now - last >= MAX_AGE_MS;
        });

        if (!stale.length) return;

        let deleted = 0;
        for (let i = 0; i < stale.length; i += BATCH_SIZE) {
          const batch = stale.slice(i, i + BATCH_SIZE).map((f) => f.fullPath);
          await deletePublicFiles(batch);
          deleted += batch.length;
        }

        console.info(`[cron] tmp upload cleanup deleted ${deleted} files`);
      } catch (error) {
        console.error("[cron] tmp upload cleanup failed", error);
      } finally {
        running = false;
      }
    },
    { timezone: TZ },
  );
};
