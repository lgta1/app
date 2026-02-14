import { getMangaPublishedById } from "./manga.query";

import { CHAPTER_STATUS } from "~/constants/chapter";
import { ChapterModel } from "~/database/models/chapter.model";
import { ensureChapterSlug, ensureChapterSlugsForManga } from "~/database/helpers/chapter-slug.helper";
import type { UserType } from "~/database/models/user.model";
import { isAdmin } from "~/helpers/user.helper";
import { rewriteLegacyCdnUrl } from "~/.server/utils/cdn-url";

const withId = <T extends Record<string, any>>(doc: T) => ({
  ...doc,
  id: String((doc as any)?.id ?? (doc as any)?._id ?? ""),
});

const normalizeChapter = (doc: any) => {
  if (!doc) return doc;
  const urls: unknown[] = Array.isArray(doc?.contentUrls) ? doc.contentUrls : [];
  return {
    ...(doc as any),
    contentUrls: urls.map((u) => (typeof u === "string" ? rewriteLegacyCdnUrl(u) : String(u ?? ""))),
  };
};

export const getChaptersByMangaId = async (mangaId: string, user?: UserType) => {
  const manga = await getMangaPublishedById(mangaId, user);
  if (!manga) {
    return [];
  }

  let query: any = { mangaId };
  if (manga.ownerId !== user?.id && !isAdmin(user?.role || "")) {
    query = {
      ...query,
      status: CHAPTER_STATUS.APPROVED,
    };
  }

  const chaptersRaw = await ChapterModel.find(query).sort({ createdAt: -1 }).lean();
  const chapters = (chaptersRaw as any[]).map((c) => normalizeChapter(withId(c)));

  // Backfill stable slugs (one-time) to support SEO URLs.
  if (chapters.some((c: any) => !c?.slug)) {
    await ensureChapterSlugsForManga(manga.id);
    const refetched = await ChapterModel.find(query).sort({ createdAt: -1 }).lean();
    return (refetched as any[]).map((c) => normalizeChapter(withId(c)));
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

  const chapterRaw = await ChapterModel.findOne({
    mangaId,
    chapterNumber,
  }).lean();

  const chapter = chapterRaw ? withId(chapterRaw as any) : null;
  const normalized = chapter ? normalizeChapter(chapter) : null;

  // Ensure stable slug exists for downstream canonical/links
  if (normalized && !normalized?.slug) {
    await ensureChapterSlug(normalized);
  }

  if (normalized?.status === CHAPTER_STATUS.APPROVED) {
    return normalized;
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

  const chapterRaw = await ChapterModel.findOne({
    mangaId,
    slug: chapterSlug,
  }).lean();

  const chapter = chapterRaw ? withId(chapterRaw as any) : null;
  const normalized = chapter ? normalizeChapter(chapter) : null;

  if (normalized?.status === CHAPTER_STATUS.APPROVED) {
    return normalized;
  }

  return null;
};
