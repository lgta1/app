import { getLeaderboardModel, type LeaderboardPeriod } from "@/services/leaderboard.svc";

import { MANGA_STATUS } from "~/constants/manga";
import { MangaModel } from "~/database/models/manga.model";

export const getNewManga = async (page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;
  const mangas = await MangaModel.find({})
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  return mangas.map((manga) => ({
    ...manga,
    id: manga._id.toString(),
  }));
};

export const getTotalMangaCount = async ({
  searchTerm,
  query = {},
}: {
  searchTerm?: string;
  query?: Record<string, any>;
}) => {
  if (searchTerm) {
    return await MangaModel.countDocuments({
      $text: { $search: searchTerm },
      ...query,
    });
  }
  return await MangaModel.countDocuments(query);
};

export const searchMangaWithPagination = async (
  searchTerm: string,
  page: number = 1,
  limit: number = 10,
) => {
  const skip = (page - 1) * limit;
  const mangas = await MangaModel.find(
    { $text: { $search: searchTerm } },
    { score: { $meta: "textScore" } },
  )
    .sort({ score: { $meta: "textScore" } })
    .skip(skip)
    .limit(limit)
    .lean();

  return mangas.map((manga) => ({
    ...manga,
    id: manga._id.toString(),
  }));
};

export const getHotManga = async () => {
  return await MangaModel.find({}).sort({ viewNumber: -1 }).limit(10).lean();
};

export const getMangaById = async (id: string) => {
  return await MangaModel.findByIdAndUpdate(
    id,
    { $inc: { viewNumber: 1 } },
    { new: true },
  ).lean();
};

export const searchMangaApprovedWithPagination = async ({
  keyword,
  page,
  limit,
  query = {},
}: {
  keyword?: string;
  page: number;
  limit: number;
  query?: Record<string, any>;
}) => {
  const skip = (page - 1) * limit;

  if (keyword) {
    return await MangaModel.find(
      { $text: { $search: keyword }, status: MANGA_STATUS.APPROVED, ...query },
      { score: { $meta: "textScore" } },
    )
      .sort({ score: { $meta: "textScore" } })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  return await MangaModel.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

export const getMangaRank = async (mangaId: string, period: LeaderboardPeriod) => {
  try {
    const Model = getLeaderboardModel(period);

    const result = await Model.findOne({ story_id: mangaId }).lean();

    return result;
  } catch (error) {
    console.error(`Lỗi khi lấy rank manga ${mangaId} trong ${period}:`, error);
    throw error;
  }
};
