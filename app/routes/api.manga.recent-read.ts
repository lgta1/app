import type { LoaderFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";

import { UserReadChapterModel } from "~/database/models/user-read-chapter.model";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    if (!user) {
      return Response.json(
        { error: "Vui lòng đăng nhập để xem lịch sử đọc" },
        { status: 401 },
      );
    }

    // Lấy danh sách chapter đã đọc và populate manga
    const skip = (page - 1) * limit;

    const recentReadChapters = await UserReadChapterModel.find({ userId: user.id })
      .populate({
        path: "chapterId",
        model: "Chapter",
        select: "mangaId",
        populate: {
          path: "mangaId",
          model: "Manga",
          select: "title poster chapters viewNumber likeNumber followNumber",
        },
      })
      .sort({ createdAt: -1 })
      .limit(100); // Lấy nhiều hơn để group by manga

    // Group by manga và lấy manga unique
    const mangaMap = new Map();
    recentReadChapters.forEach((readChapter) => {
      const chapter = readChapter.chapterId as any;
      if (chapter && chapter.mangaId && typeof chapter.mangaId === "object") {
        const manga = chapter.mangaId;
        const mangaId = manga._id.toString();

        // Chỉ lấy manga đầu tiên (đọc gần nhất)
        if (!mangaMap.has(mangaId)) {
          mangaMap.set(mangaId, {
            ...manga.toObject(),
            id: mangaId,
            lastReadAt: readChapter.createdAt,
          });
        }
      }
    });

    // Convert map to array và apply pagination
    const allMangaList = Array.from(mangaMap.values()).sort(
      (a, b) => new Date(b.lastReadAt).getTime() - new Date(a.lastReadAt).getTime(),
    );

    const totalRecentRead = allMangaList.length;
    const totalPages = Math.ceil(totalRecentRead / limit);
    const mangaList = allMangaList.slice(skip, skip + limit);

    return Response.json({
      success: true,
      data: mangaList,
      currentPage: page,
      totalPages,
      totalRecentRead,
    });
  } catch (error) {
    console.error("Error in manga recent read loader:", error);
    return Response.json({ error: "Có lỗi xảy ra khi lấy dữ liệu" }, { status: 500 });
  }
}
