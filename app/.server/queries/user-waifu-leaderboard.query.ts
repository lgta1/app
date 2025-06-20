import { UserWaifuLeaderboardModel } from "~/database/models/user-waifu-leaderboard";

export const getUserWaifuLeaderboard = async (page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;

  const totalCount = await UserWaifuLeaderboardModel.countDocuments();
  const totalPages = Math.ceil(totalCount / limit);

  const userWaifusLeaderboard = await UserWaifuLeaderboardModel.find()
    .sort({
      totalWaifu5Stars: -1,
      totalWaifu4Stars: -1,
      totalWaifu3Stars: -1,
      totalWaifu: -1,
    })
    .skip(skip)
    .limit(limit)
    .select("-waifuCollection")
    .lean();

  return {
    data: userWaifusLeaderboard,
    currentPage: page,
    totalPages,
    totalCount,
  };
};
