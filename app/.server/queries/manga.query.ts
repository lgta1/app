import { isValidObjectId } from "mongoose";

import { MANGA_STATUS } from "~/constants/manga";
import { MangaModel } from "~/database/models/manga.model";

export const getNewManga = async (page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;
  return await MangaModel.find({ status: MANGA_STATUS.APPROVED })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

export const getAllMangaAdmin = async (page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;
  return await MangaModel.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
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
  return await MangaModel.find(
    { $text: { $search: searchTerm } },
    { score: { $meta: "textScore" } },
  )
    .sort({ score: { $meta: "textScore" } })
    .skip(skip)
    .limit(limit)
    .lean();
};

export const getMangaApprovedById = async (id: string) => {
  return await MangaModel.findOneAndUpdate(
    { _id: id, status: MANGA_STATUS.APPROVED },
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
    const mangas = await MangaModel.find(
      { $text: { $search: keyword }, status: MANGA_STATUS.APPROVED, ...query },
      { score: { $meta: "textScore" } },
    )
      .sort({ score: { $meta: "textScore" } })
      .skip(skip)
      .limit(limit)
      .lean();

    if (mangas.length === 0 && isValidObjectId(keyword)) {
      return [await MangaModel.findById(keyword).lean()];
    }

    return mangas;
  }

  return await MangaModel.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

export const getRelatedManga = async (genres: string[], limit: number = 10) => {
  return await MangaModel.find({ genres: { $in: genres } })
    .limit(limit)
    .lean();
};

export const getMangaByIdAndOwner = async (
  id: string,
  ownerId: string,
  isAdmin: boolean = false,
) => {
  return await MangaModel.findOne({
    _id: id,
    ...(!isAdmin && { ownerId }),
  }).lean();
};
