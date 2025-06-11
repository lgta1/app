import { ENV } from "@/configs/env.config";

import { InteractionModel } from "~/database/models/interaction.model";
import {
  DailyLeaderboardModel,
  MonthlyLeaderboardModel,
  WeeklyLeaderboardModel,
} from "~/database/models/leaderboard.model";
import { BusinessError } from "~/helpers/errors.helper";

export type LeaderboardPeriod = "daily" | "weekly" | "monthly";

/**
 * Tính toán ngày bắt đầu dựa trên period
 */
const getStartDate = (period: LeaderboardPeriod): Date => {
  const now = new Date();

  switch (period) {
    case "daily":
      // Bắt đầu từ 00:00:00 của ngày hôm nay
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());

    case "weekly":
      // Bắt đầu từ 00:00:00 của Chủ nhật tuần này
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return startOfWeek;

    case "monthly":
      // Bắt đầu từ 00:00:00 của ngày đầu tháng
      return new Date(now.getFullYear(), now.getMonth(), 1);

    default:
      throw new BusinessError(`Invalid period: ${period}`);
  }
};

/**
 * Lấy collection model tương ứng với period
 */
export const getLeaderboardModel = (period: LeaderboardPeriod) => {
  switch (period) {
    case "daily":
      return DailyLeaderboardModel;
    case "weekly":
      return WeeklyLeaderboardModel;
    case "monthly":
      return MonthlyLeaderboardModel;
    default:
      throw new BusinessError(`Invalid period: ${period}`);
  }
};

/**
 * Tạo aggregation pipeline để tính toán leaderboard
 */
export const generateLeaderboardPipeline = (period: LeaderboardPeriod) => {
  const startDate = getStartDate(period);
  const targetCollection = `${period}_leaderboard`;

  return [
    // Stage 1: Lọc interactions theo thời gian
    {
      $match: {
        created_at: { $gte: startDate },
      },
    },
    // Stage 2: Nhóm theo story_id và đếm số lượng từng loại interaction
    {
      $group: {
        _id: "$story_id",
        views: {
          $sum: {
            $cond: [{ $eq: ["$type", "view"] }, 1, 0],
          },
        },
        likes: {
          $sum: {
            $cond: [{ $eq: ["$type", "like"] }, 1, 0],
          },
        },
        comments: {
          $sum: {
            $cond: [{ $eq: ["$type", "comment"] }, 1, 0],
          },
        },
      },
    },

    // Stage 3: Tính điểm dựa trên công thức
    {
      $addFields: {
        score: {
          $add: [
            { $multiply: ["$views", ENV.LEADERBOARD[period].VIEW_WEIGHT] },
            { $multiply: ["$likes", ENV.LEADERBOARD[period].LIKE_WEIGHT] },
            { $multiply: ["$comments", ENV.LEADERBOARD[period].COMMENT_WEIGHT] },
          ],
        },
      },
    },

    // Stage 4: Sắp xếp theo điểm số giảm dần
    {
      $sort: { score: -1 },
    },

    // Stage 5: Giới hạn số lượng
    {
      $limit: ENV.LEADERBOARD.MAX_ITEMS,
    },

    // Stage 6: Thêm rank sử dụng setWindowFields (MongoDB >= 5.0)
    {
      $setWindowFields: {
        sortBy: { score: -1 },
        output: {
          rank: { $denseRank: {} },
        },
      },
    },

    // Stage 7: Project để tạo document đầu ra với $ifNull handling
    {
      $project: {
        _id: 0,
        rank: 1,
        score: 1,
        story_id: "$_id",
        views_in_period: "$views",
        likes_in_period: "$likes",
        comments_in_period: "$comments",
        calculated_at: new Date(),
      },
    },

    // Stage 8: Lưu kết quả vào target collection
    {
      $out: targetCollection,
    },
  ];
};

/**
 * Thực thi tính toán leaderboard cho một period cụ thể
 */
export const calculateLeaderboard = async (period: LeaderboardPeriod): Promise<void> => {
  try {
    console.info(`Bắt đầu tính toán leaderboard ${period}...`);

    const pipeline = generateLeaderboardPipeline(period);
    await InteractionModel.aggregate(pipeline as any);

    console.info(`Hoàn thành tính toán leaderboard ${period}`);
  } catch (error) {
    console.error(`Lỗi khi tính toán leaderboard ${period}:`, error);
    throw error;
  }
};
