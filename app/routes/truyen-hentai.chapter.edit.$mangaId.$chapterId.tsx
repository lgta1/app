import { redirect } from "react-router";

import { updateChapter } from "@/mutations/chapter.mutation";
import { getUserInfoFromSession } from "@/services/session.svc";

import { MangaModel } from "~/database/models/manga.model";
import { ChapterModel } from "~/database/models/chapter.model";
import type { UserType } from "~/database/models/user.model";
import { BusinessError } from "~/helpers/errors.helper";
import { isAdmin } from "~/helpers/user.helper";
import { resolveMangaHandle } from "~/database/helpers/manga-slug.helper";

export { default } from "./truyen-hentai.chapter.edit.$mangaId";

export async function loader({ request, params }: any) {
  const handle = String(params?.mangaId ?? "");
  const chapterId = String(params?.chapterId ?? "");
  if (!handle) {
    throw new BusinessError("Không tìm thấy manga ID");
  }
  if (!chapterId) {
    throw new BusinessError("Không tìm thấy chapter ID");
  }

  const user = (await getUserInfoFromSession(request)) as UserType | null;
  if (!user) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  const target = await resolveMangaHandle(handle);
  if (!target) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  const mangaId = String((target as any).id ?? (target as any)._id ?? "");
  const canonicalHandle = (target as any).slug || mangaId;

  // Non-admins can only edit their own manga.
  if (!isAdmin(String((user as any).role ?? ""))) {
    const ok = await MangaModel.findOne({ _id: mangaId, ownerId: (user as any).id }).select({ _id: 1 }).lean();
    if (!ok) {
      throw new BusinessError("Không tìm thấy manga hoặc bạn không có quyền chỉnh sửa");
    }
  }

  const chapter = await ChapterModel.findOne({ _id: chapterId, mangaId }).lean();
  if (!chapter) {
    throw new BusinessError("Không tìm thấy chương");
  }

  return { chapter, mangaHandle: canonicalHandle };
}

export async function action({ request, params }: any) {
  try {
    const handle = String(params?.mangaId ?? "");
    const chapterId = String(params?.chapterId ?? "");
    if (!handle) {
      throw new BusinessError("Không tìm thấy manga ID");
    }
    if (!chapterId) {
      throw new BusinessError("Không tìm thấy chapter ID");
    }

    const formData = await request.formData();
    const target = await resolveMangaHandle(handle);
    if (!target) {
      throw new BusinessError("Không tìm thấy truyện");
    }

    const mangaId = String((target as any).id ?? (target as any)._id ?? "");

    const chapter = await ChapterModel.findOne({ _id: chapterId, mangaId }).select({ chapterNumber: 1 }).lean();
    const chapterNumber = Number((chapter as any)?.chapterNumber);
    if (!chapter || !Number.isFinite(chapterNumber) || chapterNumber < 1) {
      throw new BusinessError("Không tìm thấy chương");
    }

    const title = (formData.get("title") as string) ?? "";
    const contentUrls = JSON.parse(formData.get("contentUrls") as string);
    if (!contentUrls || contentUrls.length === 0) {
      throw new BusinessError("Vui lòng tải lên ít nhất một ảnh");
    }

    await updateChapter(request, mangaId, chapterNumber, {
      title: title.trim(),
      contentUrls,
    });

    const nextHandle = (target as any).slug || mangaId;
    return redirect(`/truyen-hentai/preview/${nextHandle}`);
  } catch (error) {
    if (error instanceof BusinessError) {
      return {
        success: false,
        error: { message: error.message },
      };
    }

    return {
      success: false,
      error: { message: "Có lỗi xảy ra khi cập nhật chương" },
    };
  }
}
