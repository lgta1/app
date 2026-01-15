import { UserModel } from "../../database/models/user.model";
import { UserWaifuInventoryModel } from "../../database/models/user-waifu-inventory";
import { WaifuModel } from "../../database/models/waifu.model";
import { getUserWaifuInventoryCollection } from "./user-waifu-inventory.query";
import { rewriteLegacyCdnUrl } from "../utils/cdn-url";
import { normalizeWaifuImageUrl } from "../utils/waifu-image";
import { ROLES } from "../../constants/user";

export const getUserWaifuLeaderboard = async (page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;

  const waifuCollectionName = WaifuModel.collection.name;
  const userCollectionName = UserModel.collection.name;
  const objectIdLike = /^[a-f\d]{24}$/i;

  // Aggregate unique waifu counts per user from canonical inventory.
  // Note: inventory stores ids as strings; $lookup requires ObjectId, so we cast with $toObjectId.
  const agg = await UserWaifuInventoryModel.aggregate([
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
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: "count" }],
      },
    },
  ]);

  const rows: any[] = agg?.[0]?.data ?? [];
  const totalCount = Number(agg?.[0]?.totalCount?.[0]?.count ?? 0);
  const totalPages = Math.ceil(totalCount / limit);

  const startRank = skip + 1;

  const normalized = await Promise.all(
    rows.map(async (row: any, idx: number) => {
      const userId = String(row?._id || "");
      const u = row?.user;
      const rank = startRank + idx;

      const base: any = {
        userId,
        userName: u?.name,
        userAvatar: typeof u?.avatar === "string" ? rewriteLegacyCdnUrl(u.avatar) : u?.avatar,
        userLevel: u?.level,
        userFaction: u?.faction,
        userGender: u?.gender,
        totalWaifu: row?.totalWaifu ?? 0,
        totalWaifu3Stars: row?.totalWaifu3Stars ?? 0,
        totalWaifu4Stars: row?.totalWaifu4Stars ?? 0,
        totalWaifu5Stars: row?.totalWaifu5Stars ?? 0,
      };

      // Keep behavior: only include waifuCollection for global top 5.
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

  return {
    data: normalized,
    currentPage: page,
    totalPages,
    totalCount,
  };
};
