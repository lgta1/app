import cron from "node-cron";

import { calculateLeaderboard } from "~/helpers/leaderboard.server";

/**
 * Khởi tạo các cron jobs để tự động tính toán leaderboard
 */
export const initLeaderboardScheduler = (): void => {
  console.info("Khởi tạo leaderboard scheduler...");

  // BXH Ngày: Chạy vào 00:05 hàng ngày
  cron.schedule(
    "5 0 * * *",
    async () => {
      try {
        console.info("Bắt đầu tính toán BXH ngày...");
        await calculateLeaderboard("daily");
        console.info("Hoàn thành tính toán BXH ngày");
      } catch (error) {
        console.error("Lỗi khi tính toán BXH ngày:", error);
      }
    },
    {
      timezone: "Asia/Ho_Chi_Minh",
    },
  );

  // BXH Tuần: Chạy vào 01:05 sáng Chủ nhật
  cron.schedule(
    "5 1 * * 0",
    async () => {
      try {
        console.info("Bắt đầu tính toán BXH tuần...");
        await calculateLeaderboard("weekly");
        console.info("Hoàn thành tính toán BXH tuần");
      } catch (error) {
        console.error("Lỗi khi tính toán BXH tuần:", error);
      }
    },
    {
      timezone: "Asia/Ho_Chi_Minh",
    },
  );

  // BXH Tháng: Chạy vào 02:05 ngày đầu tiên của tháng
  cron.schedule(
    "5 2 1 * *",
    async () => {
      try {
        console.info("Bắt đầu tính toán BXH tháng...");
        await calculateLeaderboard("monthly");
        console.info("Hoàn thành tính toán BXH tháng");
      } catch (error) {
        console.error("Lỗi khi tính toán BXH tháng:", error);
      }
    },
    {
      timezone: "Asia/Ho_Chi_Minh",
    },
  );

  console.info("Đã khởi tạo xong các cron jobs cho leaderboard");
};

/**
 * Tính toán manual leaderboard (dùng cho testing hoặc khởi tạo ban đầu)
 */
export const calculateAllLeaderboards = async (): Promise<void> => {
  console.info("Bắt đầu tính toán tất cả leaderboards...");

  try {
    await Promise.all([
      calculateLeaderboard("daily"),
      calculateLeaderboard("weekly"),
      calculateLeaderboard("monthly"),
    ]);
    console.info("Hoàn thành tính toán tất cả leaderboards");
  } catch (error) {
    console.error("Lỗi khi tính toán leaderboards:", error);
    throw error;
  }
};
