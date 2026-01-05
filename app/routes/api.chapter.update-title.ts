import type { Route } from "./+types/api.chapter.update-title";

import { requireLogin } from "~/.server/services/auth.server";
import { isAdmin, isDichGia } from "~/helpers/user.helper";
import { BusinessError } from "~/helpers/errors.helper";
import { ChapterModel } from "~/database/models/chapter.model";
import { MangaModel } from "~/database/models/manga.model";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST" && request.method !== "PUT" && request.method !== "PATCH") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const user = await requireLogin(request);

    const body = await request.json();
    const chapterId = String(body?.chapterId || "");
    const title = String(body?.title || "").trim();
    const mangaId = String(body?.mangaId || "");

    if (!chapterId || !mangaId || !title) {
      return Response.json({ success: false, error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }

    const chapter = await ChapterModel.findById(chapterId).lean();
    const manga = await MangaModel.findById(mangaId).lean();

    if (!chapter) return Response.json({ success: false, error: "Chương không tồn tại" }, { status: 404 });
    if (!manga) return Response.json({ success: false, error: "Truyện không tồn tại" }, { status: 404 });
    if (String(chapter.mangaId) !== String(manga._id)) {
      return Response.json({ success: false, error: "Chương không thuộc truyện này" }, { status: 400 });
    }

    const normalize = (v: any) => String(v ?? "").trim().toLowerCase();
    const isOwner = String(manga.ownerId) === String(user.id);
    const isTranslatorForManga =
      isDichGia(user.role) && normalize((user as any)?.name) && normalize((manga as any)?.translationTeam) &&
      normalize((user as any)?.name) === normalize((manga as any)?.translationTeam);

    const canEdit = isAdmin(user.role) || isOwner || isTranslatorForManga;
    if (!canEdit) return Response.json({ success: false, error: "Forbidden" }, { status: 403 });

  // Cập nhật tiêu đề chapter; KHÔNG đụng tới manga.updatedAt theo quy chuẩn mới
  await ChapterModel.findByIdAndUpdate(chapterId, { $set: { title } });

    return Response.json({ success: true, message: "Đã cập nhật tên chương", chapter: { id: chapterId, title } });
  } catch (err) {
    if (err instanceof BusinessError) {
      return Response.json({ success: false, error: err.message }, { status: 400 });
    }
    console.error("[POST /api/chapter/update-title] error:", err);
    return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
