import cron from "node-cron";
import mongoose from "mongoose";

import { notifyNewChapter } from "@/services/notification.svc";
import { CHAPTER_STATUS } from "~/constants/chapter";
import { ChapterModel } from "~/database/models/chapter.model";
import { MangaModel } from "~/database/models/manga.model";
import { SystemLockModel } from "~/database/models/system-lock.model";

const TZ = "Asia/Ho_Chi_Minh";
const LOCK_KEY = "chapter-schedule-publish";
const MAX_BATCH = 50;

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

export const initScheduledChapterPublishScheduler = (): void => {
  const isPrimaryInstance = process.env.CHAPTER_PUBLISH_SCHEDULER === "1";
  if (!isPrimaryInstance) return;

  const isMongoReady = () => mongoose.connection.readyState === 1;
  let running = false;

  cron.schedule(
    "*/1 * * * *",
    async () => {
      if (running) return;
      if (!isMongoReady()) return;

      running = true;
      try {
        const acquired = await tryAcquireLock(50_000);
        if (!acquired) return;

        const now = new Date();
        const due = await ChapterModel.find({
          status: CHAPTER_STATUS.SCHEDULED,
          publishAt: { $lte: now },
        })
          .sort({ publishAt: 1, chapterNumber: 1 })
          .limit(MAX_BATCH)
          .lean();

        for (const row of due) {
          const chapterId = String((row as any)?._id || "");
          if (!chapterId) continue;

          const publishedAt = new Date();
          const updatedChapter = await ChapterModel.findOneAndUpdate(
            {
              _id: chapterId,
              status: CHAPTER_STATUS.SCHEDULED,
              publishAt: { $lte: publishedAt },
            },
            {
              $set: {
                status: CHAPTER_STATUS.APPROVED,
                publishedAt,
              },
            },
            { new: true },
          );

          if (!updatedChapter) continue;

          const manga = await MangaModel.findById((updatedChapter as any).mangaId);
          if (!manga) continue;

          try {
            await MangaModel.updateOne(
              { _id: manga.id },
              {
                $max: { chapters: Number((updatedChapter as any).chapterNumber) || 0 },
                $set: { updatedAt: publishedAt },
              },
              { timestamps: false },
            );
          } catch (updateError) {
            console.warn("[chapter-schedule] Failed to update manga counters", updateError);
          }

          try {
            await notifyNewChapter(updatedChapter as any, manga as any);
          } catch (notifyError) {
            console.warn("[chapter-schedule] Failed to notify followers", notifyError);
          }
        }
      } catch (error) {
        console.error("[chapter-schedule] publish job failed", error);
      } finally {
        running = false;
      }
    },
    { timezone: TZ },
  );
};
