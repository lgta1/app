import cron from "node-cron";
import mongoose from "mongoose";
import { calculateLeaderboard } from "@/services/leaderboard.svc";
import { MangaModel } from "~/database/models/manga.model";

/**
 * Khởi tạo các cron jobs để tự động tính toán leaderboard
 */
export const initLeaderboardScheduler = (): void => {
  // Nếu bạn chạy nhiều instance, chỉ cho 1 instance bật scheduler:
  // - Cách 1: set env LEADERBOARD_SCHEDULER=1 cho đúng 1 instance
  // - Cách 2: kiểm tra PORT cố định (ví dụ 3001)
  const isPrimaryInstance =
    process.env.LEADERBOARD_SCHEDULER === "1" ||
    process.env.PORT === "3001";

  if (!isPrimaryInstance) {
    return; // Không khởi tạo scheduler ở các instance phụ
  }

  const TZ = "Asia/Ho_Chi_Minh";
  const isMongoReady = () => mongoose.connection.readyState === 1;

  // ─────────────────────────────────────────────────────────────
  // DAILY: chạy MỖI 30 PHÚT cả ngày (rolling 6h được xử lý trong service)
  // ─────────────────────────────────────────────────────────────
  let runningDaily = false;
  cron.schedule(
    "*/30 * * * *",
    async () => {
      if (runningDaily) return; // chống chồng job
      if (!isMongoReady()) {
        console.warn("[cron] Leaderboard daily skipped: MongoDB not connected");
        return;
      }
      runningDaily = true;
      try {
        await calculateLeaderboard("daily");
      } catch (error) {
        console.error("Lỗi khi tính toán BXH ngày (30p):", error);
      } finally {
        runningDaily = false;
      }
    },
    { timezone: TZ },
  );

  // ─────────────────────────────────────────────────────────────
  // (ĐÃ LOẠI BỎ) Weekly/Monthly aggregation cũ không còn chạy.
  // Hiện tại BXH tuần/tháng dùng counters trực tiếp (weeklyViews/monthlyViews).

  // ─────────────────────────────────────────────────────────────
  // DAILY RESET COUNTER: 00:05 every day — set dailyViews = 0
  // ─────────────────────────────────────────────────────────────
  cron.schedule(
    "5 0 * * *",
    async () => {
      try {
        if (!isMongoReady()) {
          console.warn("[cron] Daily views reset skipped: MongoDB not connected");
          return;
        }
        const r = await MangaModel.updateMany({}, { $set: { dailyViews: 0 } }, { timestamps: false });
        const matched =
          typeof r === "object" && r !== null && "matchedCount" in r
            ? (r as { matchedCount?: number }).matchedCount ?? 0
            : 0;
        console.info(`[cron] Daily views reset → matched ${matched} docs`);
      } catch (e) {
        console.error("[cron] Daily views reset failed", e);
      }
    },
    { timezone: TZ },
  );

  // ─────────────────────────────────────────────────────────────
  // WEEKLY RESET COUNTER: 00:00 every Monday — set weeklyViews = 0
  // ─────────────────────────────────────────────────────────────
  cron.schedule(
    "0 0 * * 1",
    async () => {
      try {
        if (!isMongoReady()) {
          console.warn("[cron] Weekly views reset skipped: MongoDB not connected");
          return;
        }
        const r = await MangaModel.updateMany({}, { $set: { weeklyViews: 0 } }, { timestamps: false });
        const matched =
          typeof r === "object" && r !== null && "matchedCount" in r
            ? (r as { matchedCount?: number }).matchedCount ?? 0
            : 0;
        console.info(`[cron] Weekly views reset → matched ${matched} docs`);
      } catch (e) {
        console.error("[cron] Weekly views reset failed", e);
      }
    },
    { timezone: TZ },
  );

  // ─────────────────────────────────────────────────────────────
  // MONTHLY RESET COUNTER: 00:00 on day 1 — set monthlyViews = 0
  // ─────────────────────────────────────────────────────────────
  cron.schedule(
    "0 0 1 * *",
    async () => {
      try {
        if (!isMongoReady()) {
          console.warn("[cron] Monthly views reset skipped: MongoDB not connected");
          return;
        }
        const r = await MangaModel.updateMany({}, { $set: { monthlyViews: 0 } }, { timestamps: false });
        const matched =
          typeof r === "object" && r !== null && "matchedCount" in r
            ? (r as { matchedCount?: number }).matchedCount ?? 0
            : 0;
        console.info(`[cron] Monthly views reset → matched ${matched} docs`);
      } catch (e) {
        console.error("[cron] Monthly views reset failed", e);
      }
    },
    { timezone: TZ },
  );
};

/**
 * Tính toán manual leaderboard (dùng cho testing hoặc khởi tạo ban đầu)
 */
export const calculateAllLeaderboards = async (): Promise<void> => {
  // Chỉ còn daily dùng snapshot aggregation; weekly/monthly bỏ (dùng counters realtime)
  try {
    await calculateLeaderboard("daily");
  } catch (error) {
    console.error("Lỗi khi tính toán leaderboard daily:", error);
    throw error;
  }
};
