import { getLeaderboardModel, type LeaderboardPeriod } from "@/services/leaderboard.svc";

export const getLeaderboard = async (period: LeaderboardPeriod) => {
  const leaderboard = await getLeaderboardModel(period)
    .find({})
    .sort({ rank: 1 })
    .populate("story_id")
    .lean();

  return leaderboard.map((item) => item.story_id);
};
