import { ROLES } from "~/constants/user";
import { UserModel } from "~/database/models/user.model";
import { UserWaifuInventoryModel } from "~/database/models/user-waifu-inventory";
import { WaifuModel } from "~/database/models/waifu.model";
import { WaifuLeaderboardSnapshotModel } from "~/database/models/waifu-leaderboard-snapshot.model";
import { getUserWaifuInventoryCollection } from "~/.server/queries/user-waifu-inventory.query";
import { rewriteLegacyCdnUrl } from "~/.server/utils/cdn-url";
import { normalizeWaifuImageUrl } from "~/.server/utils/waifu-image";

const WAIFU_LEADERBOARD_MAX_ITEMS =
  Number(process.env.WAIFU_LEADERBOARD_MAX_ITEMS) || 1000;

const normalizeUserAvatar = (avatar: unknown) =>
  typeof avatar === "string" ? rewriteLegacyCdnUrl(avatar) : avatar;

export const calculateWaifuLeaderboardSnapshot = async (): Promise<number> => {
  const waifuCollectionName = WaifuModel.collection.name;
  const userCollectionName = UserModel.collection.name;
  const objectIdLike = /^[a-f\d]{24}$/i;
  const now = new Date();

  const rows = await UserWaifuInventoryModel.aggregate([
    {
      $match: {
        count: { $gt: 0 },
        userId: { $type: "string", $regex: objectIdLike },
        waifuId: { $type: "string", $regex: objectIdLike },
      },
    },
    {
      $addFields: {
        waifuObjId: { $toObjectId: "$waifuId" },
      },
    },
    {
      $lookup: {
        from: waifuCollectionName,
        localField: "waifuObjId",
        foreignField: "_id",
        as: "waifu",
      },
    },
    { $unwind: "$waifu" },
    { $match: { "waifu.stars": { $gte: 3 } } },
    {
      $group: {
        _id: "$userId",
        totalWaifu: { $sum: 1 },
        totalWaifu3Stars: {
          $sum: {
            $cond: [{ $eq: ["$waifu.stars", 3] }, 1, 0],
          },
        },
        totalWaifu4Stars: {
          $sum: {
            $cond: [{ $eq: ["$waifu.stars", 4] }, 1, 0],
          },
        },
        totalWaifu5Stars: {
          $sum: {
            $cond: [{ $eq: ["$waifu.stars", 5] }, 1, 0],
          },
        },
      },
    },
    {
      $addFields: {
        userObjId: { $toObjectId: "$_id" },
      },
    },
    {
      $lookup: {
        from: userCollectionName,
        localField: "userObjId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $match: {
        "user.isDeleted": false,
        "user.isBanned": false,
        "user.role": { $ne: ROLES.ADMIN },
      },
    },
    {
      $sort: {
        totalWaifu5Stars: -1,
        totalWaifu4Stars: -1,
        totalWaifu3Stars: -1,
        totalWaifu: -1,
      },
    },
    { $limit: WAIFU_LEADERBOARD_MAX_ITEMS },
  ]);

  const payload = await Promise.all(
    rows.map(async (row: any, index: number) => {
      const userId = String(row?._id || "");
      const u = row?.user;
      const rank = index + 1;

      const base: any = {
        rank,
        userId,
        userName: u?.name,
        userAvatar: normalizeUserAvatar(u?.avatar),
        userLevel: u?.level,
        userFaction: u?.faction,
        userGender: u?.gender,
        totalWaifu: row?.totalWaifu ?? 0,
        totalWaifu3Stars: row?.totalWaifu3Stars ?? 0,
        totalWaifu4Stars: row?.totalWaifu4Stars ?? 0,
        totalWaifu5Stars: row?.totalWaifu5Stars ?? 0,
        waifuCollection: [],
        calculatedAt: now,
      };

      if (rank <= 5) {
        const inv = await getUserWaifuInventoryCollection(userId);
        base.waifuCollection = (inv?.waifuCollection || []).map((w: any) => {
          const nextImg = normalizeWaifuImageUrl(w?.image);
          return nextImg ? { ...w, image: nextImg } : w;
        });
      }

      return base;
    }),
  );

  await WaifuLeaderboardSnapshotModel.deleteMany({});
  if (payload.length > 0) {
    await WaifuLeaderboardSnapshotModel.insertMany(payload, { ordered: false });
  }

  return payload.length;
};

export const getWaifuLeaderboardSnapshot = async (page: number = 1, limit: number = 10) => {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const safePage = Math.max(1, page);
  const skip = (safePage - 1) * safeLimit;

  const totalCount = await WaifuLeaderboardSnapshotModel.countDocuments();
  const totalPages = Math.max(1, Math.ceil(totalCount / safeLimit));

  const data = await WaifuLeaderboardSnapshotModel.find({})
    .sort({ rank: 1 })
    .skip(skip)
    .limit(safeLimit)
    .lean();

  return {
    data,
    currentPage: safePage,
    totalPages,
    totalCount,
  };
};
