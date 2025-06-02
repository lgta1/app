import { MangaModel } from "~/database/models/manga.model";
import { getLeaderboardModel, type LeaderboardPeriod } from "@/services/leaderboard.svc";

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

export const getTotalMangaCount = async (searchTerm?: string) => {
  if (searchTerm) {
    return await MangaModel.countDocuments({
      $text: { $search: searchTerm },
    });
  }
  return await MangaModel.countDocuments({});
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

export const searchManga = async (keyword: string) => {
  return await MangaModel.find(
    { $text: { $search: keyword } },
    { score: { $meta: "textScore" } },
  )
    .sort({ score: { $meta: "textScore" } })
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
