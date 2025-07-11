import { getMangaPublishedById } from "./manga.query";

import { CHAPTER_STATUS } from "~/constants/chapter";
import { ChapterModel } from "~/database/models/chapter.model";
import type { UserType } from "~/database/models/user.model";
import { isAdmin } from "~/helpers/user.helper";

export const getChaptersByMangaId = async (mangaId: string, user?: UserType) => {
  const manga = await getMangaPublishedById(mangaId, user);
  if (!manga) {
    return [];
  }

  let query: any = { mangaId };
  if (manga.ownerId !== user?.id && !isAdmin(user?.role || "")) {
    query = { ...query, status: CHAPTER_STATUS.APPROVED };
  }

  return await ChapterModel.find(query).sort({ createdAt: -1 }).lean();
};

export const getChaptersByMangaIdAndNumber = async (
  mangaId: string,
  chapterNumber: number,
  user?: UserType,
) => {
  const manga = await getMangaPublishedById(mangaId, user);
  if (!manga) {
    return null;
  }

  const chapter = await ChapterModel.findOne({
    mangaId,
    chapterNumber,
  }).lean();

  if (chapter?.status === CHAPTER_STATUS.APPROVED) {
    return chapter;
  }

  if (manga.ownerId === user?.id || isAdmin(user?.role || "")) {
    return chapter;
  }

  return null;
};
