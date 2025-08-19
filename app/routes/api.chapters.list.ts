import type { LoaderFunctionArgs } from "react-router";

import { CHAPTER_STATUS } from "~/constants/chapter";
import { ChapterModel } from "~/database/models/chapter.model";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const mangaId = url.searchParams.get("mangaId");

    if (!mangaId) {
      return Response.json({ error: "Manga ID is required" }, { status: 400 });
    }

    // Lấy danh sách chapters với status APPROVED và PENDING, sắp xếp theo chapterNumber
    const chapters = await ChapterModel.find({
      mangaId: mangaId,
      status: { $in: [CHAPTER_STATUS.APPROVED, CHAPTER_STATUS.PENDING] },
    })
      .select("chapterNumber title status")
      .sort({ chapterNumber: -1 })
      .lean();

    const formattedChapters = chapters.map((chapter) => ({
      value: chapter.chapterNumber,
      label: `Chương ${chapter.chapterNumber}`,
      title: chapter.title,
      status: chapter.status,
    }));

    return Response.json({
      success: true,
      chapters: formattedChapters,
    });
  } catch (error) {
    console.error("Error fetching chapters:", error);
    return Response.json(
      { error: "Có lỗi xảy ra khi lấy danh sách chương" },
      { status: 500 },
    );
  }
}
