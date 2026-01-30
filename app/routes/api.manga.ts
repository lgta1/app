import type { ActionFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";

import { MangaModel } from "~/database/models/manga.model";
import { isAdmin } from "~/helpers/user.helper";
import { hardDeleteManga } from "~/.server/mutations/manga.mutation";

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

    const isAdminUser = isAdmin(user.role);
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    if (!isAdminUser) {
      const createdAt = manga.createdAt instanceof Date ? manga.createdAt : new Date(manga.createdAt);
      const ageMs = Date.now() - createdAt.getTime();
      if (!Number.isFinite(createdAt.getTime()) || ageMs > SEVEN_DAYS_MS) {
        return Response.json(
          {
            error: "Bạn không thể xoá truyện đã đăng quá 7 ngày. Chỉ admin có thể xoá.",
            success: false,
          },
          { status: 403 },
        );
      }
    }

    const result = await hardDeleteManga(request, mangaId);

    return Response.json({
      success: true,
      message: "Xóa truyện và tất cả dữ liệu liên quan thành công",
      ...result,
    });
  } catch (error) {
    console.error("Error deleting manga:", error);
    return Response.json({ error: "Có lỗi xảy ra khi xóa truyện" }, { status: 500 });
  }
}
