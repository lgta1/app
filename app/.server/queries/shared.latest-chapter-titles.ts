import { ChapterModel } from "~/database/models/chapter.model";
import { CHAPTER_STATUS } from "~/constants/chapter";

/**
 * Return map { [mangaId]: latestChapterTitle }
 * Sort by mangaId asc, chapterNumber desc, createdAt desc; then group-first.
 */
export async function getLatestChapterTitlesForMangaIds(mangaIds: string[]) {
  if (!Array.isArray(mangaIds) || mangaIds.length === 0) return {} as Record<string, string>;
  const docs: any[] = await ChapterModel.aggregate([
    { $match: { mangaId: { $in: mangaIds }, status: { $in: [CHAPTER_STATUS.APPROVED, CHAPTER_STATUS.PENDING] } } },
    { $sort: { mangaId: 1, chapterNumber: -1, createdAt: -1 } },
    // Only keep the needed fields to reduce compute
    { $group: { _id: "$mangaId", title: { $first: "$title" } } },
  ]).exec();
  const map: Record<string, string> = {};
  for (const d of docs) if (d && d._id) map[String(d._id)] = d.title ?? "";
  return map;
}
