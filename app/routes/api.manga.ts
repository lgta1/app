import type { ActionFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";

import { ChapterModel } from "~/database/models/chapter.model";
import { CommentModel } from "~/database/models/comment.model";
import { MangaModel } from "~/database/models/manga.model";
import { UserModel } from "~/database/models/user.model";
import { UserFollowMangaModel } from "~/database/models/user-follow-manga.model";
import { UserLikeMangaModel } from "~/database/models/user-like-manga.model";
import { UserReadChapterModel } from "~/database/models/user-read-chapter.model";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "DELETE") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const user = await getUserInfoFromSession(request);

    if (!user) {
      return Response.json(
        { error: "Vui lòng đăng nhập để thực hiện thao tác này" },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const intent = formData.get("intent");
    const mangaId = formData.get("mangaId") as string;

    if (intent !== "delete" || !mangaId) {
      return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }

    // Tìm manga và validate owner
    const manga = await MangaModel.findById(mangaId);

    if (!manga) {
      return Response.json({ error: "Không tìm thấy truyện" }, { status: 404 });
    }

    // Validate chỉ owner mới được xóa
    if (manga.ownerId !== user.id) {
      return Response.json(
        { error: "Bạn không có quyền xóa truyện này" },
        { status: 403 },
      );
    }

    // Lấy tất cả chapterIds để xóa UserReadChapter records
    const chapters = await ChapterModel.find({ mangaId: mangaId }).select("_id");
    const chapterIds = chapters.map((chapter) => chapter._id.toString());

    // Xóa cascade tất cả dữ liệu liên quan
    await Promise.all([
      // Xóa lịch sử đọc chapters của manga này
      UserReadChapterModel.deleteMany({ chapterId: { $in: chapterIds } }),

      // Xóa comments của manga
      CommentModel.deleteMany({ mangaId: mangaId }),

      // Xóa follow relationships
      UserFollowMangaModel.deleteMany({ mangaId: mangaId }),

      // Xóa like relationships
      UserLikeMangaModel.deleteMany({ mangaId: mangaId }),

      // Xóa tất cả chapters của manga
      ChapterModel.deleteMany({ mangaId: mangaId }),
    ]);

    // Cuối cùng xóa manga
    await MangaModel.findByIdAndDelete(mangaId);

    await UserModel.findByIdAndUpdate(manga.ownerId, { $inc: { mangasCount: -1 } });

    return Response.json({
      success: true,
      message: "Xóa truyện và tất cả dữ liệu liên quan thành công",
    });
  } catch (error) {
    console.error("Error deleting manga:", error);
    return Response.json({ error: "Có lỗi xảy ra khi xóa truyện" }, { status: 500 });
  }
}
