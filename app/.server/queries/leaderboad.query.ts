import { getLeaderboardModel, type LeaderboardPeriod } from "@/services/leaderboard.svc";

import { MANGA_STATUS } from "~/constants/manga";

export const getLeaderboard = async (period: LeaderboardPeriod) => {
  const leaderboard = await getLeaderboardModel(period)
    .find({})
    .sort({ rank: 1 })
    .populate("story_id")
    .lean();

  return leaderboard
    .map((item) => item.story_id)
    .filter((manga: any) => manga?.status === MANGA_STATUS.APPROVED);
};
