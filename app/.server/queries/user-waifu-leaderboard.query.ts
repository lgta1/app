import { UserWaifuLeaderboardModel } from "~/database/models/user-waifu-leaderboard";

export const getUserWaifuLeaderboard = async (page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;

  const totalCount = await UserWaifuLeaderboardModel.countDocuments();
  const totalPages = Math.ceil(totalCount / limit);

  // Tính toán xem có user nào trong top 3 không
  const startRank = skip + 1;
  const includeWaifuCollection = startRank <= 3;

  const query = UserWaifuLeaderboardModel.find()
    .sort({
      totalWaifu5Stars: -1,
      totalWaifu4Stars: -1,
      totalWaifu3Stars: -1,
      totalWaifu: -1,
    })
    .skip(skip)
    .limit(limit);

  // Chỉ exclude waifuCollection nếu không có user nào trong top 3
  if (!includeWaifuCollection) {
    query.select("-waifuCollection");
  }

  const userWaifusLeaderboard = await query.lean();

  return {
    data: userWaifusLeaderboard,
    currentPage: page,
    totalPages,
    totalCount,
  };
};
