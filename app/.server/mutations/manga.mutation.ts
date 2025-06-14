import { getUserInfoFromSession } from "@/services/session.svc";

import { MANGA_STATUS } from "~/constants/manga";
import { MangaModel, type MangaType } from "~/database/models/manga.model";
import { UserModel } from "~/database/models/user.model";
import { BusinessError } from "~/helpers/errors.helper";
import { isAdmin } from "~/helpers/user.helper";

export const likeManga = async (request: Request, mangaId: string) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để thích truyện");
  }

  const checkLiked = await UserModel.findOne({ _id: userInfo.id, likedManga: mangaId });
  if (checkLiked) {
    throw new BusinessError("Bạn đã thích truyện này rồi");
  }

  const manga = await MangaModel.findByIdAndUpdate(mangaId, { $inc: { likeNumber: 1 } });
  if (!manga) {
    throw new BusinessError("Truyện không tồn tại");
  }

  await UserModel.findByIdAndUpdate(userInfo.id, { $push: { likedManga: mangaId } });

  return {
    success: true,
    message: "Thích truyện thành công",
  };
};

export const unlikeManga = async (request: Request, mangaId: string) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để bỏ thích truyện");
  }

  const checkLiked = await UserModel.findOne({ _id: userInfo.id, likedManga: mangaId });
  if (!checkLiked) {
    throw new BusinessError("Bạn chưa thích truyện này");
  }

  await UserModel.findByIdAndUpdate(userInfo.id, { $pull: { likedManga: mangaId } });

  await MangaModel.findByIdAndUpdate(mangaId, { $inc: { likeNumber: -1 } });

  return {
    success: true,
    message: "Bỏ thích truyện thành công",
  };
};

export const deleteManga = async (request: Request, mangaId: string) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để xóa truyện");
  }

  if (!isAdmin(userInfo.role)) {
    throw new BusinessError("Bạn không có quyền xóa truyện");
  }

  await MangaModel.findByIdAndDelete(mangaId);

  return {
    success: true,
    message: "Xóa truyện thành công",
  };
};

export const createManga = async (
  request: Request,
  manga: Omit<MangaType, "id" | "createdAt" | "updatedAt" | "chapters">,
) => {
  if (![MANGA_STATUS.WAITING, MANGA_STATUS.PENDING].includes(manga.status)) {
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
