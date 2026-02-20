import type { Route } from "./+types/api.chapter.update-status";

import { requireLogin } from "~/.server/services/auth.server";
import { CHAPTER_STATUS } from "~/constants/chapter";
import { ChapterModel } from "~/database/models/chapter.model";
import { BusinessError } from "~/helpers/errors.helper";
import { isAdmin } from "~/helpers/user.helper";

export async function action({ request }: Route.ActionArgs) {
  try {
    const user = await requireLogin(request);

    // Kiểm tra quyền admin
    if (!isAdmin(user.role)) {
      return Response.json(
        { error: "Bạn không có quyền thực hiện hành động này" },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const chapterId = formData.get("chapterId") as string;
    const status = parseInt(formData.get("status") as string);
    const mangaId = formData.get("mangaId") as string;
    const chapterNumber = parseInt(formData.get("chapterNumber") as string);

    // Validate input
    if (!chapterId || isNaN(status) || !mangaId || isNaN(chapterNumber)) {
      return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }

    // Validate status value
    const validStatuses = [CHAPTER_STATUS.APPROVED, CHAPTER_STATUS.SCHEDULED];
    if (!validStatuses.includes(status)) {
      return Response.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
    }

    // Find and update chapter
    const chapter = await ChapterModel.findById(chapterId);
    if (!chapter) {
      return Response.json({ error: "Không tìm thấy chương" }, { status: 404 });
    }

    // Verify chapter belongs to the manga
    if (chapter.mangaId !== mangaId || chapter.chapterNumber !== chapterNumber) {
      return Response.json({ error: "Thông tin chương không khớp" }, { status: 400 });
    }

    const now = new Date();
    const nextUpdate =
      status === CHAPTER_STATUS.APPROVED
        ? {
            status,
            publishedAt: now,
            publishAt: undefined,
          }
        : {
            status,
            publishedAt: undefined,
          };

    await ChapterModel.findByIdAndUpdate(chapterId, {
      $set: nextUpdate,
    });

    const statusLabels = {
      [CHAPTER_STATUS.APPROVED]: "Đã duyệt",
      [CHAPTER_STATUS.SCHEDULED]: "Hẹn giờ đăng",
    };

    return Response.json({
      success: true,
      message: `Đã cập nhật trạng thái chương thành "${statusLabels[status]}"`,
    });
  } catch (error) {
    console.error("Error updating chapter status:", error);

    if (error instanceof BusinessError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ error: "Lỗi server" }, { status: 500 });
  }
}
