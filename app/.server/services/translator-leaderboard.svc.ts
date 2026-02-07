import { MANGA_CONTENT_TYPE, MANGA_STATUS } from "~/constants/manga";
import { ROLES } from "~/constants/user";
import { MangaModel } from "~/database/models/manga.model";
import { UserModel } from "~/database/models/user.model";
import {
  TranslatorAlltimeLeaderboardModel,
  TranslatorMonthlyLeaderboardModel,
  TranslatorWeeklyLeaderboardModel,
} from "~/database/models/translator-leaderboard.model";

export type TranslatorLeaderboardPeriod = "weekly" | "monthly" | "alltime";

const TRANSLATOR_LEADERBOARD_MAX_ITEMS =
  Number(process.env.TRANSLATOR_LEADERBOARD_MAX_ITEMS) || 100;

const getTranslatorLeaderboardModel = (period: TranslatorLeaderboardPeriod) => {
  if (period === "weekly") return TranslatorWeeklyLeaderboardModel;
  if (period === "monthly") return TranslatorMonthlyLeaderboardModel;
  return TranslatorAlltimeLeaderboardModel;
};

const getViewsField = (period: TranslatorLeaderboardPeriod) => {
  if (period === "weekly") return "$weeklyViews";
  if (period === "monthly") return "$monthlyViews";
  return "$viewNumber";
};

export const calculateTranslatorLeaderboard = async (
  period: TranslatorLeaderboardPeriod,
  options?: { limit?: number },
) => {
  const limit = Math.max(1, options?.limit ?? TRANSLATOR_LEADERBOARD_MAX_ITEMS);
  const viewsField = getViewsField(period);
  const now = new Date();

  const rows = await MangaModel.aggregate([
    {
      $match: {
        status: MANGA_STATUS.APPROVED,
        contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
        ownerId: { $type: "string", $ne: "" },
      },
    },
    {
      $addFields: {
        ownerObjectId: {
          $convert: {
            input: "$ownerId",
            to: "objectId",
            onError: null,
            onNull: null,
          },
        },
      },
    },
    { $match: { ownerObjectId: { $ne: null } } },
    {
      $group: {
        _id: "$ownerObjectId",
        totalViews: { $sum: { $ifNull: [viewsField, 0] } },
      },
    },
    {
      $lookup: {
        from: UserModel.collection.name,
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $match: {
        "user.role": ROLES.DICHGIA,
        "user.isDeleted": false,
        "user.isBanned": false,
      },
    },
    { $sort: { totalViews: -1, _id: 1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        totalViews: 1,
        userName: "$user.name",
        userAvatar: "$user.avatar",
      },
    },
  ]);

  const payload = rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    calculatedAt: now,
  }));

  const Model = getTranslatorLeaderboardModel(period);
  await Model.deleteMany({});
  if (payload.length > 0) {
    await Model.insertMany(payload, { ordered: false });
  }

  return payload.length;
};

export const getTranslatorLeaderboardSnapshot = async (
  period: TranslatorLeaderboardPeriod,
  limit?: number,
) => {
  const cappedLimit = Math.max(1, Math.min(limit ?? TRANSLATOR_LEADERBOARD_MAX_ITEMS, 200));
  const Model = getTranslatorLeaderboardModel(period);
  return Model.find({})
    .sort({ rank: 1 })
    .limit(cappedLimit)
    .lean();
};
