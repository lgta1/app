import { getUserInfoFromSession } from "@/services/session.svc";

import { MANGA_STATUS } from "~/constants/manga";
import { ChapterModel } from "~/database/models/chapter.model";
import { CommentModel } from "~/database/models/comment.model";
import { MangaModel, type MangaType } from "~/database/models/manga.model";
import { UserModel } from "~/database/models/user.model";
import { UserFollowMangaModel } from "~/database/models/user-follow-manga.model";
import { UserLikeMangaModel } from "~/database/models/user-like-manga.model";
import { UserReadChapterModel } from "~/database/models/user-read-chapter.model";
import { BusinessError } from "~/helpers/errors.helper";
import { isAdmin } from "~/helpers/user.helper";

export const deleteManga = async (request: Request, mangaId: string) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để xóa truyện");
  }

  if (!isAdmin(userInfo.role)) {
    throw new BusinessError("Bạn không có quyền xóa truyện");
  }

  const manga = await MangaModel.findById(mangaId);

  if (!manga) {
    throw new BusinessError("Không tìm thấy truyện");
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

  return {
    success: true,
    message: "Xóa truyện thành công",
  };
};

export const createManga = async (
  request: Request,
  manga: Omit<MangaType, "id" | "createdAt" | "updatedAt" | "chapters">,
) => {
  if (![MANGA_STATUS.CREATING, MANGA_STATUS.PENDING].includes(manga.status)) {
    throw new BusinessError("Truyện không được tạo với trạng thái này");
  }

  return await MangaModel.create({
    ...manga,
  });
};

export const updateManga = async (
  request: Request,
  id: string,
  data: Partial<Omit<MangaType, "_id" | "createdAt" | "updatedAt" | "chapters">>,
) => {
  const manga = await MangaModel.findById(id);

  if (!manga) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  await MangaModel.findByIdAndUpdate(id, { $set: data });
};

export const submitMangaToReview = async (request: Request, mangaId: string) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để nộp truyện");
  }

  const updatedManga = await MangaModel.findOneAndUpdate(
    {
      _id: mangaId,
      ownerId: userInfo.id,
      status: { $ne: MANGA_STATUS.PENDING },
    },
    { $set: { status: MANGA_STATUS.PENDING } },
  );

  if (!updatedManga) {
    throw new BusinessError("Truyện đã được nộp");
  }

  return {
    success: true,
    message: "Nộp truyện thành công",
  };
};

export const approveManga = async (request: Request, mangaId: string) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để duyệt truyện");
  }

  if (!isAdmin(userInfo.role)) {
    throw new BusinessError("Bạn không có quyền duyệt truyện");
  }

  const manga = await MangaModel.findById(mangaId);
  if (!manga) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  await MangaModel.findByIdAndUpdate(mangaId, {
    $set: { status: MANGA_STATUS.APPROVED, updatedAt: new Date() },
  });

  return {
    success: true,
    message: "Duyệt truyện thành công",
  };
};

export const rejectManga = async (request: Request, mangaId: string) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để từ chối truyện");
  }

  if (!isAdmin(userInfo.role)) {
    throw new BusinessError("Bạn không có quyền từ chối truyện");
  }

  const manga = await MangaModel.findById(mangaId);
  if (!manga) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  await MangaModel.findByIdAndUpdate(mangaId, {
    $set: { status: MANGA_STATUS.REJECTED, updatedAt: new Date() },
  });

  return {
    success: true,
    message: "Từ chối truyện thành công",
  };
};
