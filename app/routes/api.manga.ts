import type { ActionFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";

import { ChapterModel } from "~/database/models/chapter.model";
import { CommentModel } from "~/database/models/comment.model";
import { MangaModel } from "~/database/models/manga.model";
import { UserModel } from "~/database/models/user.model";
import { UserFollowMangaModel } from "~/database/models/user-follow-manga.model";
import { UserLikeMangaModel } from "~/database/models/user-like-manga.model";
import { UserReadChapterModel } from "~/database/models/user-read-chapter.model";
import { isAdmin } from "~/helpers/user.helper";
import { MINIO_CONFIG } from "@/configs/minio.config";
import { getCdnBase } from "~/.server/utils/cdn-url";
import { deleteFiles, getEnvironmentPrefix, listFiles } from "~/utils/minio.utils";

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

    const envPrefix = getEnvironmentPrefix();
    const bucketMarker = `/${String(MINIO_CONFIG.DEFAULT_BUCKET || "")}/`;
    const cdnBase = getCdnBase(request as any).replace(/\/+$/, "");

    const toFullPathIfInternal = (urlRaw?: string | null) => {
      const u = (urlRaw || "").toString().trim();
      if (!u) return null;
      if (!(u.startsWith(cdnBase + "/") || u.includes(bucketMarker))) return null;
      try {
        const url = new URL(u);
        if (bucketMarker && url.pathname.includes(bucketMarker)) {
          const rest = url.pathname.split(bucketMarker)[1];
          return rest ? rest.replace(/^\/+/, "") : null;
        }
        return url.pathname.replace(/^\/+/, "");
      } catch {
        return null;
      }
    };

    const deletePrefix = async (prefixPath: string) => {
      const normalized = prefixPath.replace(/^\/+|\/+$/g, "");
      const actualPrefix = envPrefix ? `${envPrefix}/${normalized}` : normalized;
      const files = await listFiles({ prefixPath: actualPrefix, recursive: true, isPublic: true } as any);
      const fullPaths = files.map((f: any) => String(f.fullPath || "")).filter(Boolean);
      const CHUNK = 500;
      for (let i = 0; i < fullPaths.length; i += CHUNK) {
        await deleteFiles(fullPaths.slice(i, i + CHUNK));
      }
    };

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

    // Best-effort cleanup storage (avoid blocking delete if storage fails)
    try {
      await deletePrefix(`manga-images/${mangaId}`);

      const posterFullPath = toFullPathIfInternal((manga as any)?.poster);
      const shareFullPath = toFullPathIfInternal((manga as any)?.shareImage);
      const toDelete = [posterFullPath, shareFullPath].filter(Boolean) as string[];
      if (toDelete.length) {
        await deleteFiles(toDelete);
      }
    } catch (cleanupError) {
      console.warn("[api.manga delete] storage cleanup failed", cleanupError);
    }

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
