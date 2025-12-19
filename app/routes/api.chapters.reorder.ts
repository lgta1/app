// Using untyped args to avoid typegen dependency at edit-time

import { requireLogin } from "~/.server/services/auth.server";
import { isAdmin } from "~/helpers/user.helper";
import { BusinessError } from "~/helpers/errors.helper";
import { MangaModel } from "~/database/models/manga.model";
import { reorderChaptersByIds } from "~/.server/mutations/chapter.mutation";

export async function action({ request }: any) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const user = await requireLogin(request);
    const body = await request.json();

    const mangaId = String(body?.mangaId || "");
    const orderedChapterIds = Array.isArray(body?.orderedChapterIds)
      ? body.orderedChapterIds.map((x: any) => String(x))
      : [];

    if (!mangaId || orderedChapterIds.length === 0) {
      return Response.json({ success: false, error: "Thiếu mangaId hoặc danh sách chương" }, { status: 400 });
    }

    const manga = await MangaModel.findById(mangaId).lean();
    if (!manga) return Response.json({ success: false, error: "Truyện không tồn tại" }, { status: 404 });

    const canEdit = isAdmin(user.role) || String(manga.ownerId) === String(user.id);
    if (!canEdit) return Response.json({ success: false, error: "Forbidden" }, { status: 403 });

    // Thực thi reorder theo danh sách ID (thứ tự tăng dần STT)
    const result = await reorderChaptersByIds(mangaId, orderedChapterIds);

    // KHÔNG cập nhật manga.updatedAt theo quy chuẩn mới
    return Response.json({ success: true, message: "Đã sắp xếp lại chương", ...result });
  } catch (err) {
    if (err instanceof BusinessError) {
      return Response.json({ success: false, error: err.message }, { status: 400 });
    }
    console.error("[POST /api/chapters/reorder] error:", err);
    return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
