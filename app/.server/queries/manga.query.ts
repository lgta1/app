import { MANGA_STATUS } from "~/constants/manga";
import { MangaModel } from "~/database/models/manga.model";
import type { UserType } from "~/database/models/user.model";
import { isAdmin } from "~/helpers/user.helper";

export const getNewManga = async (page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;

  const filter = {
    status: { $in: [MANGA_STATUS.APPROVED, MANGA_STATUS.PENDING] },
  };

  const [manga, totalCount] = await Promise.all([
    MangaModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    MangaModel.countDocuments(filter),
  ]);

  return {
    manga,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page,
  };
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
      {
        $text: { $search: keyword },
        status: { $in: [MANGA_STATUS.APPROVED, MANGA_STATUS.PENDING] },
        ...query,
      },
      { score: { $meta: "textScore" } },
    )
      .sort({ score: { $meta: "textScore" } })
      .skip(skip)
      .limit(limit)
      .lean();

    if (mangas.length === 0 && Number.isInteger(Number(keyword))) {
      return await MangaModel.find({
        code: keyword,
        status: { $in: [MANGA_STATUS.APPROVED, MANGA_STATUS.PENDING] },
      }).lean();
    }

    return mangas;
  }

  return await MangaModel.find({
    status: { $in: [MANGA_STATUS.APPROVED, MANGA_STATUS.PENDING] },
    ...query,
  })
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

export const getMangaPublishedById = async (id: string, user?: UserType) => {
  const manga = await MangaModel.findById(id).lean();

  if ([MANGA_STATUS.APPROVED, MANGA_STATUS.PENDING].includes(manga?.status ?? Infinity)) {
    return manga;
  }

  if (manga?.ownerId === user?.id || isAdmin(user?.role || "")) {
    return manga;
  }

  return null;
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
