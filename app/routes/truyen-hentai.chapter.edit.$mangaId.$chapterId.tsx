import { redirect } from "react-router";

import { updateChapter } from "@/mutations/chapter.mutation";
import { requireLogin } from "@/services/auth.server";

import { MangaModel } from "~/database/models/manga.model";
import { ChapterModel } from "~/database/models/chapter.model";
import type { UserType } from "~/database/models/user.model";
import { BusinessError } from "~/helpers/errors.helper";
import { isAdmin, isDichGia } from "~/helpers/user.helper";
import { resolveMangaHandle } from "~/database/helpers/manga-slug.helper";

export { EditChapterView as default } from "./truyen-hentai.chapter.edit.$mangaId";

export async function loader({ request, params }: any) {
  const handle = String(params?.mangaId ?? "");
  const chapterId = String(params?.chapterId ?? "");
  if (!handle) {
    throw new BusinessError("Không tìm thấy manga ID");
  }
  if (!chapterId) {
    throw new BusinessError("Không tìm thấy chapter ID");
  }

  const user = (await requireLogin(request)) as UserType;
  const canSkipWatermark = isDichGia(String((user as any).role || "")) && Boolean((user as any).canSkipWatermark);

  const target = await resolveMangaHandle(handle);
  if (!target) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  const mangaId = String((target as any).id ?? (target as any)._id ?? "");
  const canonicalHandle = (target as any).slug || mangaId;

  // Non-admins can only edit their own manga.
  if (!isAdmin(String((user as any).role ?? ""))) {
    const normalize = (v: any) => String(v ?? "").trim().toLowerCase();
    const okOwner = await MangaModel.findOne({ _id: mangaId, ownerId: (user as any).id }).select({ _id: 1, translationTeam: 1 }).lean();
    const isTranslatorForManga =
      isDichGia(String((user as any).role ?? "")) && normalize((user as any)?.name) && normalize((target as any)?.translationTeam) &&
      normalize((user as any)?.name) === normalize((target as any)?.translationTeam);

    if (!okOwner && !isTranslatorForManga) {
      throw new BusinessError("Không tìm thấy manga hoặc bạn không có quyền chỉnh sửa");
    }
  }

  const chapter = await ChapterModel.findOne({ _id: chapterId, mangaId }).lean();
  if (!chapter) {
    throw new BusinessError("Không tìm thấy chương");
  }

  return { chapter, mangaHandle: canonicalHandle, canSkipWatermark, mangaGenres: (target as any)?.genres };
}

export async function action({ request, params }: any) {
  try {
    await requireLogin(request);
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
