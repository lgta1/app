import type { LoaderFunctionArgs } from "react-router";

import { CHAPTER_STATUS } from "~/constants/chapter";
import { ChapterModel } from "~/database/models/chapter.model";
import { getChapterDisplayName } from "../utils/chapter.utils";
import { sharedTtlCache } from "~/.server/utils/ttl-cache";
import { json } from "~/utils/json.server";
import { ensureChapterSlugsForManga } from "~/database/helpers/chapter-slug.helper";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const mangaId = url.searchParams.get("mangaId");

    if (!mangaId) {
      return json({ error: "Manga ID is required" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    // Ensure legacy chapters have stable slugs (one-time).
    const missing = await ChapterModel.exists({
      mangaId,
      $or: [{ slug: { $exists: false } }, { slug: "" }],
    });
    if (missing) {
      await ensureChapterSlugsForManga(mangaId);
    }

    // Lấy danh sách chapters với status APPROVED và PENDING, sắp xếp theo chapterNumber
    // Cache ngắn để giảm tải DB vì endpoint này bị gọi rất nhiều (mỗi trang chapter).
    const chapters = await sharedTtlCache.getOrSet(
      `api:chapters-list:${mangaId}`,
      30_000,
      () =>
        ChapterModel.find({
          mangaId: mangaId,
          status: { $in: [CHAPTER_STATUS.APPROVED, CHAPTER_STATUS.PENDING] },
        })
          .select("chapterNumber title status slug")
          .sort({ chapterNumber: -1 })
          .lean(),
    );

    const formattedChapters = chapters.map((chapter) => ({
      value: chapter.chapterNumber,
      label: getChapterDisplayName(chapter.title as any, chapter.chapterNumber as any),
      title: chapter.title,
      status: chapter.status,
      slug: (chapter as any).slug,
    }));

    return json(
      {
        success: true,
        chapters: formattedChapters,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
          "CDN-Cache-Control": "public, max-age=120, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching chapters:", error);
    return json(
      { error: "Có lỗi xảy ra khi lấy danh sách chương" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
