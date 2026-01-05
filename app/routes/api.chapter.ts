// app/routes/api.chapter.ts
import type { ActionFunctionArgs } from "react-router";
import { requireLogin } from "~/.server/services/auth.server";
import { isAdmin, isDichGia } from "~/helpers/user.helper";
import { BusinessError } from "~/helpers/errors.helper";

import { MangaModel } from "~/database/models/manga.model";
import { ChapterModel } from "~/database/models/chapter.model";
import { renumberAfterDelete } from "~/.server/mutations/chapter.mutation";
// Nếu có các bảng phụ:
import { CommentModel } from "~/database/models/comment.model";
import { UserReadChapterModel } from "~/database/models/user-read-chapter.model";

// Hàm xóa file storage (MinIO/S3). Đổi import theo dự án của bạn:
import { deleteFiles } from "~/utils/minio.utils";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "DELETE") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const user = await requireLogin(request);
    const url = new URL(request.url);
    const mangaId = url.searchParams.get("mangaId") || "";
    const chapterId = url.searchParams.get("chapterId") || "";

    if (!mangaId || !chapterId) {
      return Response.json({ success: false, error: "Thiếu mangaId hoặc chapterId" }, { status: 400 });
    }

    const [manga, chapter] = await Promise.all([
      MangaModel.findById(mangaId).lean(),
      ChapterModel.findById(chapterId).lean(),
    ]);

    if (!manga) return Response.json({ success: false, error: "Truyện không tồn tại" }, { status: 404 });
    if (!chapter) return Response.json({ success: false, error: "Chương không tồn tại" }, { status: 404 });
    if (String(chapter.mangaId) !== String(manga._id)) {
      return Response.json({ success: false, error: "Chapter không thuộc manga này" }, { status: 400 });
    }

    const normalize = (v: any) => String(v ?? "").trim().toLowerCase();
    const isOwner = String(manga.ownerId) === String(user.id);
    const isTranslatorForManga =
      isDichGia(user.role) && normalize((user as any)?.name) && normalize((manga as any)?.translationTeam) &&
      normalize((user as any)?.name) === normalize((manga as any)?.translationTeam);

    const canDelete = isAdmin(user.role) || isOwner || isTranslatorForManga;
    if (!canDelete) return Response.json({ success: false, error: "Forbidden" }, { status: 403 });

    // Non-admin: chỉ được xóa chapter trong vòng 72h kể từ lúc tạo.
    if (!isAdmin(user.role)) {
      const THREE_DAYS_MS = 72 * 60 * 60 * 1000;
      const createdAtRaw = (chapter as any)?.createdAt;
      const createdAt = createdAtRaw instanceof Date ? createdAtRaw : new Date(createdAtRaw);
      const ts = createdAt.getTime();
      const ageMs = Date.now() - ts;
      if (!Number.isFinite(ts) || ageMs > THREE_DAYS_MS) {
        return Response.json(
          { success: false, error: "Đã quá 72h từ khi tạo chương. Chỉ admin mới có thể xoá." },
          { status: 403 },
        );
      }
    }

    // Gom danh sách file ảnh để xóa – ưu tiên fileKey, fallback từ URL
    const fileKeys: string[] = [];
    const pages = (chapter as any).pages ?? [];
    for (const p of pages) {
      if (p?.fileKey) fileKeys.push(String(p.fileKey));
      else if (p?.url) {
        const u = String(p.url);
        const i = u.indexOf("manga-images/"); // đúng prefix bạn dùng khi upload
        fileKeys.push(i >= 0 ? u.slice(i) : u);
      }
    }

    // Xóa dữ liệu phụ thuộc
    await Promise.all([
      CommentModel?.deleteMany?.({ chapterId }).catch(() => null),
      UserReadChapterModel?.deleteMany?.({ chapterId }).catch(() => null),
      // Thêm các bảng phụ khác nếu có, theo khóa chapterId
    ]);

    // Xóa file ảnh (best-effort)
    if (fileKeys.length) {
      try { await deleteFiles(fileKeys); } catch (e) { console.warn("[DELETE /api/chapter] deleteFiles warn:", e); }
    }

    // Xóa chapter
    await ChapterModel.findByIdAndDelete(chapterId);

    // Renumber các chương phía sau (đóng lỗ) và giảm tổng số chương.
    try {
      const deletedNumber = Number((chapter as any).chapterNumber);
      if (Number.isFinite(deletedNumber)) {
        await renumberAfterDelete(String(manga._id), deletedNumber);
        await MangaModel.updateOne({ _id: manga._id }, { $inc: { chapters: -1 } }, { timestamps: false });
      }
    } catch (e) {
      console.error("[DELETE /api/chapter] renumberAfterDelete warn:", e);
      // Không throw để tránh 500 nếu xóa thành công nhưng renumber lỗi bất ngờ
    }

    // KHÔNG cập nhật manga.updatedAt khi xóa chương theo quy chuẩn mới

    return Response.json({ success: true, message: "Đã xóa chương, đóng lỗ STT và dọn ảnh liên quan" });
  } catch (err) {
    if (err instanceof BusinessError) {
      return Response.json({ success: false, error: err.message }, { status: 400 });
    }
    console.error("[DELETE /api/chapter] error:", err);
    return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
