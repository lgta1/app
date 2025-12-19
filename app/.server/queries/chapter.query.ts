import { getMangaPublishedById } from "./manga.query";

import { CHAPTER_STATUS } from "~/constants/chapter";
import { ChapterModel } from "~/database/models/chapter.model";
import { ensureChapterSlug, ensureChapterSlugsForManga } from "~/database/helpers/chapter-slug.helper";
import type { UserType } from "~/database/models/user.model";
import { isAdmin } from "~/helpers/user.helper";

export const getChaptersByMangaId = async (mangaId: string, user?: UserType) => {
  const manga = await getMangaPublishedById(mangaId, user);
  if (!manga) {
    return [];
  }

  let query: any = { mangaId };
  if (manga.ownerId !== user?.id && !isAdmin(user?.role || "")) {
    query = {
      ...query,
      status: { $in: [CHAPTER_STATUS.APPROVED, CHAPTER_STATUS.PENDING] },
    };
  }

  const chapters = await ChapterModel.find(query).sort({ createdAt: -1 }).lean();

  // Backfill stable slugs (one-time) to support SEO URLs.
  if (chapters.some((c: any) => !c?.slug)) {
    await ensureChapterSlugsForManga(manga.id);
    return await ChapterModel.find(query).sort({ createdAt: -1 }).lean();
  }

  return chapters;
};

export const getChapterByMangaIdAndNumber = async (
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

  // Ensure stable slug exists for downstream canonical/links
  if (chapter && !chapter?.slug) {
    await ensureChapterSlug(chapter);
  }

  if (
    chapter?.status === CHAPTER_STATUS.APPROVED ||
    chapter?.status === CHAPTER_STATUS.PENDING
  ) {
    return chapter;
  }

  if (manga.ownerId === user?.id || isAdmin(user?.role || "")) {
    return chapter;
  }

  return null;
};

export const getChapterByMangaIdAndSlug = async (
  mangaId: string,
  chapterSlug: string,
  user?: UserType,
) => {
  const manga = await getMangaPublishedById(mangaId, user);
  if (!manga) {
    return null;
  }

  // Ensure legacy chapters can be resolved by slug.
  await ensureChapterSlugsForManga(manga.id);

  const chapter = await ChapterModel.findOne({
    mangaId,
    slug: chapterSlug,
  }).lean();

  if (
    chapter?.status === CHAPTER_STATUS.APPROVED ||
    chapter?.status === CHAPTER_STATUS.PENDING
  ) {
    return chapter;
  }

  if (manga.ownerId === user?.id || isAdmin(user?.role || "")) {
    return chapter;
  }

  return null;
};
