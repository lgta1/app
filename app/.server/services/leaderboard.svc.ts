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
      // (ĐÃ ĐỔI) Daily = cửa sổ ROLLING 6 GIỜ gần nhất
      return new Date(now.getTime() - 6 * 3600 * 1000);

    case "weekly":
      // ĐỔI: Weekly = cửa sổ ROLLING 7 NGÀY gần nhất
      return new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    case "monthly":
      // ĐỔI: Monthly = cửa sổ ROLLING 30 NGÀY gần nhất
      return new Date(now.getTime() - 30 * 24 * 3600 * 1000);

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
export const generateLeaderboardPipeline = (
  period: LeaderboardPeriod,
  options?: { useMergeOn?: boolean },
) => {
  const startDate = getStartDate(period);
  const targetCollection = `${period}_leaderboard`;

  // Các mốc thời gian phục vụ bucket view (chỉ dùng cho daily rolling 6h)
  const now = new Date();
  const t2 = new Date(now.getTime() - 2 * 3600 * 1000); // ranh 2h
  const t4 = new Date(now.getTime() - 4 * 3600 * 1000); // ranh 4h
  const t6 = startDate; // ranh 6h (đúng bằng now - 6h)
  const t12 = new Date(now.getTime() - 12 * 3600 * 1000); // ranh 12h

  return [
    // Stage 1: Lọc interactions theo thời gian
    {
      $match: {
        // DAILY: cần lấy thêm khoảng 6–12h để tính 0.5 đ/1 view
        created_at: { $gte: period === "daily" ? t12 : startDate },
        // Lọc sớm chỉ lấy view & comment (daily không tính like)
        ...(period === "daily" ? { type: { $in: ["view", "comment"] } } : {}),
      },
    },

    // Stage 2: Nhóm theo story_id và đếm số lượng từng loại interaction
    // - DAILY: tách view thành 3 bucket theo thời gian 0–2h, 2–4h, 4–6h
    // - WEEKLY/MONTHLY: giữ cách đếm tổng như cũ để không phá backward-compat
    ...(period === "daily"
      ? [
          {
            $group: {
              _id: "$story_id",
              // View 0–2h
              views_0_2h: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$type", "view"] },
                        { $gte: ["$created_at", t2] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              // View 2–4h
              views_2_4h: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$type", "view"] },
                        { $gte: ["$created_at", t4] },
                        { $lt: ["$created_at", t2] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              // View 4–6h
              views_4_6h: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$type", "view"] },
                        { $gte: ["$created_at", t6] },
                        { $lt: ["$created_at", t4] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              // Comment: chỉ tính trong 6h gần nhất (không tính 6–12h)
              comments: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$type", "comment"] },
                        { $gte: ["$created_at", t6] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              // View 6–12h: mỗi view = 0.5 điểm (sẽ cộng vào score ở stage sau)
              views_6_12h: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$type", "view"] },
                        { $gte: ["$created_at", t12] },
                        { $lt: ["$created_at", t6] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              // Tie-breaker theo thời gian tương tác mới nhất
              last_interaction_at: { $max: "$created_at" },
            },
          },
        ]
      : [
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
              last_interaction_at: { $max: "$created_at" },
            },
          },
        ]),

    // Stage 3: Tính điểm dựa trên công thức
    ...(period === "daily"
      ? [
          // Tính _views_weighted trước, tách stage để tránh tham chiếu trường mới trong cùng stage
          {
            $addFields: {
              _views_weighted: {
                $add: [
                  { $multiply: [{ $ifNull: ["$views_0_2h", 0] }, 3] },
                  { $multiply: [{ $ifNull: ["$views_2_4h", 0] }, 2] },
                  { $multiply: [{ $ifNull: ["$views_4_6h", 0] }, 1] },
                ],
              },
            },
          },
          // Sau đó mới tính score, có $ifNull để không lan truyền null
          {
            $addFields: {
              score: {
                $add: [
                  // Điểm từ view 0–6h (đã nhân trọng số bucket) * VIEW_WEIGHT
                  {
                    $multiply: [
                      { $ifNull: ["$_views_weighted", 0] },
                      ENV.LEADERBOARD[period].VIEW_WEIGHT,
                    ],
                  },
                  // Điểm từ comment (chỉ 0–6h) * COMMENT_WEIGHT
                  {
                    $multiply: [
                      { $ifNull: ["$comments", 0] },
                      ENV.LEADERBOARD[period].COMMENT_WEIGHT,
                    ],
                  },
                  // Điểm từ view 6–12h: mỗi view cố định = 0.5 điểm (không nhân VIEW_WEIGHT)
                  {
                    $multiply: [
                      { $ifNull: ["$views_6_12h", 0] },
                      0.5,
                    ],
                  },
                ],
              },
            },
          },
        ]
      : [
          {
            $addFields: {
              score: {
                $add: [
                  {
                    $multiply: [
                      { $ifNull: ["$views", 0] },
                      ENV.LEADERBOARD[period].VIEW_WEIGHT,
                    ],
                  },
                  {
                    $multiply: [
                      { $ifNull: ["$likes", 0] },
                      ENV.LEADERBOARD[period].LIKE_WEIGHT,
                    ],
                  },
                  {
                    $multiply: [
                      { $ifNull: ["$comments", 0] },
                      ENV.LEADERBOARD[period].COMMENT_WEIGHT,
                    ],
                  },
                ],
              },
            },
          },
        ]),

    // Stage 4: Sắp xếp theo điểm số giảm dần (có tie-breaker ổn định)
    {
      $sort:
        period === "daily"
          ? {
              score: -1,
              last_interaction_at: -1,
              views_0_2h: -1,
              views_2_4h: -1,
              views_4_6h: -1,
            }
          : { score: -1 },
    },

    // Stage 5: Giới hạn số lượng
    {
      $limit: ENV.LEADERBOARD.MAX_ITEMS,
    },

    // Stage 6: Thêm rank sử dụng setWindowFields (MongoDB >= 5.0)
    // (TẠM TẮT để tránh lỗi trên các cluster Mongo < 5.0; vẫn giữ nguyên code để dễ bật lại)
    // {
    //   $setWindowFields: {
    //     sortBy: { score: -1 },
    //     output: {
    //       rank: { $denseRank: {} },
    //     },
    //   },
    // },

    // Stage 7: Project để tạo document đầu ra
    ...(period === "daily"
      ? [
          {
            $project: {
              // Gán _id = story_id để $merge mặc định theo _id hoạt động ổn định
              _id: "$_id",
              // rank gán null để giữ schema ổn định khi tắt window function
              rank: { $literal: null },
              score: 1,
              story_id: "$_id",
              // Xuất cả 3 bucket để quan sát/giám sát
              views_0_2h: 1,
              views_2_4h: 1,
              views_4_6h: 1,
              // Tổng view 6h nếu muốn tham chiếu tổng
              views_in_period: {
                $add: [
                  { $ifNull: ["$views_0_2h", 0] },
                  { $ifNull: ["$views_2_4h", 0] },
                  { $ifNull: ["$views_4_6h", 0] },
                ],
              },
              // Xuất thêm view_6_12h để debug/quan sát
              views_6_12h: { $ifNull: ["$views_6_12h", 0] },
              // likes_in_period giữ schema cũ (0) để không phá query cũ nếu có
              likes_in_period: { $literal: 0 },
              comments_in_period: "$comments",
              calculated_at: new Date(),
            },
          },
        ]
      : [
          {
            $project: {
              _id: "$_id",
              rank: { $literal: null },
              score: 1,
              story_id: "$_id",
              views_in_period: "$views",
              likes_in_period: "$likes",
              comments_in_period: "$comments",
              calculated_at: new Date(),
            },
          },
        ]),

    // Stage 8: Lưu kết quả vào target collection (dùng $merge)
    // - Sử dụng "on: 'story_id'" để xác định bản ghi duy nhất theo truyện
    // - Khi chạy kèm xóa trước, tập kết quả sẽ là snapshot mới nhất
    {
      $merge: {
        into: targetCollection,
        // Không chỉ định 'on' để dùng mặc định theo _id (đã set _id = story_id)
        whenMatched: "replace",
        whenNotMatched: "insert",
      },
    },
  ];
};

/**
 * Thực thi tính toán leaderboard cho một period cụ thể
 */
export const calculateLeaderboard = async (period: LeaderboardPeriod): Promise<void> => {
  // Weekly & Monthly nay dùng counters trực tiếp (weeklyViews/monthlyViews) → bỏ snapshot aggregation.
  if (period !== "daily") {
    console.info(`Bỏ qua tính toán snapshot ${period} (đã chuyển sang counters).`);
    return;
  }
  try {
    console.info(`Bắt đầu tính toán leaderboard daily (rolling 6h)...`);
    const TargetModel = getLeaderboardModel("daily");
    await TargetModel.deleteMany({});
    const pipeline = generateLeaderboardPipeline("daily", { useMergeOn: false });
    await InteractionModel.aggregate(pipeline as any);
    console.info(`Hoàn thành tính toán leaderboard daily.`);
  } catch (error) {
    console.error(`Lỗi khi tính toán leaderboard daily:`, error);
    throw error;
  }
};
