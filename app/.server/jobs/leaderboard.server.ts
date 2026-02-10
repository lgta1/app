import cron from "node-cron";
import mongoose from "mongoose";
import { calculateLeaderboard } from "@/services/leaderboard.svc";
import { calculateTranslatorLeaderboard } from "@/services/translator-leaderboard.svc";
import { calculateWaifuLeaderboardSnapshot } from "@/services/waifu-leaderboard.svc";
import { rewardWeeklyTranslatorLeaderboard } from "@/services/translator-reward.svc";
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
  // (ĐÃ LOẠI BỎ) Daily rolling 6h không còn được dùng ở UI.
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
  // WEEKLY RESET COUNTER: 02:10 every Monday — set weeklyViews = 0
  // ─────────────────────────────────────────────────────────────
  cron.schedule(
    "10 2 * * 1",
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
  // WEEKLY TRANSLATOR REWARD: 02:00 every Monday (Asia/Ho_Chi_Minh)
  // ─────────────────────────────────────────────────────────────
  let runningTranslatorReward = false;
  cron.schedule(
    "0 2 * * 1",
    async () => {
      if (runningTranslatorReward) return;
      if (!isMongoReady()) {
        console.warn("[cron] Translator weekly reward skipped: MongoDB not connected");
        return;
      }
      runningTranslatorReward = true;
      try {
        const result = await rewardWeeklyTranslatorLeaderboard();
        console.info(
          `[cron] Translator weekly reward done: week=${result.weekKey}, rewarded=${result.rewardedCount}`,
        );
      } catch (error) {
        console.error("[cron] Translator weekly reward failed", error);
      } finally {
        runningTranslatorReward = false;
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

  // ─────────────────────────────────────────────────────────────
  // TRANSLATOR LEADERBOARD SNAPSHOTS: daily at 04:30 (Asia/Ho_Chi_Minh)
  // ─────────────────────────────────────────────────────────────
  let runningTranslator = false;
  cron.schedule(
    "30 4 * * *",
    async () => {
      if (runningTranslator) return;
      if (!isMongoReady()) {
        console.warn("[cron] Translator leaderboard skipped: MongoDB not connected");
        return;
      }
      runningTranslator = true;
      try {
        await Promise.all([
          calculateTranslatorLeaderboard("weekly"),
          calculateTranslatorLeaderboard("monthly"),
          calculateTranslatorLeaderboard("alltime"),
        ]);
      } catch (error) {
        console.error("[cron] Translator leaderboard failed", error);
      } finally {
        runningTranslator = false;
      }
    },
    { timezone: TZ },
  );

  // ─────────────────────────────────────────────────────────────
  // WAIFU LEADERBOARD SNAPSHOT: daily at 04:45 (Asia/Ho_Chi_Minh)
  // ─────────────────────────────────────────────────────────────
  let runningWaifu = false;
  cron.schedule(
    "45 4 * * *",
    async () => {
      if (runningWaifu) return;
      if (!isMongoReady()) {
        console.warn("[cron] Waifu leaderboard skipped: MongoDB not connected");
        return;
      }
      runningWaifu = true;
      try {
        await calculateWaifuLeaderboardSnapshot();
      } catch (error) {
        console.error("[cron] Waifu leaderboard failed", error);
      } finally {
        runningWaifu = false;
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
