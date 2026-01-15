import { UserWaifuLeaderboardModel } from "~/database/models/user-waifu-leaderboard.model";
import { UserModel } from "~/database/models/user.model";
import { ROLES } from "~/constants/user";
import { rewriteLegacyCdnUrl } from "~/.server/utils/cdn-url";
import { normalizeWaifuImageUrl } from "~/.server/utils/waifu-image";

export const getUserWaifuLeaderboard = async (page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;

  // Exclude admins from waifu leaderboard
  const adminRows = await UserModel.find({ role: ROLES.ADMIN, isDeleted: false })
    .select("_id")
    .lean();
  const adminIds = (adminRows as any[])
    .map((u) => String(u?._id ?? u?.id ?? ""))
    .filter(Boolean);
  const baseFilter = adminIds.length > 0 ? { userId: { $nin: adminIds } } : {};

  const totalCount = await UserWaifuLeaderboardModel.countDocuments(baseFilter);
  const totalPages = Math.ceil(totalCount / limit);

  // Tính toán xem có user nào trong top 3 không
  const startRank = skip + 1;
  const includeWaifuCollection = startRank <= 3;

  const query = UserWaifuLeaderboardModel.find(baseFilter)
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

  const normalized = userWaifusLeaderboard.map((row: any) => {
    if (row && typeof row.userAvatar === "string") {
      row.userAvatar = rewriteLegacyCdnUrl(row.userAvatar);
    }

    if (row && Array.isArray(row.waifuCollection)) {
      row.waifuCollection = row.waifuCollection.map((w: any) => {
        const nextImg = normalizeWaifuImageUrl(w?.image);
        return nextImg ? { ...w, image: nextImg } : w;
      });
    }

    return row;
  });

  return {
    data: normalized,
    currentPage: page,
    totalPages,
    totalCount,
  };
};
