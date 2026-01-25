import cron from "node-cron";
import mongoose from "mongoose";

import { forceRefreshHotCarouselSnapshot } from "@/queries/leaderboad.query";
import { SystemLockModel } from "~/database/models/system-lock.model";

const TZ = "Asia/Ho_Chi_Minh";
const LOCK_KEY = "hot-carousel-snapshot";

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

export const initHotCarouselSnapshotScheduler = (): void => {
  // Keep behavior consistent with existing schedulers: enable on exactly one instance.
  // Safety: even if misconfigured, DB lock prevents concurrent runs.
  const isPrimaryInstance =
    process.env.HOT_CAROUSEL_SCHEDULER === "1" ||
    process.env.PORT === "3001";

  if (!isPrimaryInstance) return;

  let running = false;
  const isMongoReady = () => mongoose.connection.readyState === 1;

  cron.schedule(
    "*/15 * * * *",
    async () => {
      if (running) return;
      if (!isMongoReady()) {
        console.warn("[cron] Hot carousel snapshot skipped: MongoDB not connected");
        return;
      }
      running = true;
      try {
        const acquired = await tryAcquireLock(14 * 60 * 1000);
        if (!acquired) return;

        const info = await forceRefreshHotCarouselSnapshot();
        console.info(`[cron] Hot carousel snapshot refreshed @ ${info.computedAt ?? "unknown"}`);
      } catch (e) {
        console.error("[cron] Hot carousel snapshot refresh failed", e);
      } finally {
        running = false;
      }
    },
    { timezone: TZ },
  );
};
