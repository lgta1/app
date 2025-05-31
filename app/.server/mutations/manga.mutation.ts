import { ROLES } from "~/constants/user";
import { MangaModel } from "~/database/models/manga.model";
import { UserModel } from "~/database/models/user.model";
import { BusinessError } from "~/helpers/errors";
import { getUserId } from "@/services/session.svc";

export const likeManga = async (request: Request, mangaId: string) => {
  const userId = await getUserId(request);
  if (!userId) {
    throw new BusinessError("Bạn cần đăng nhập để thích truyện");
  }

  const checkLiked = await UserModel.findOne({ _id: userId, likedManga: mangaId });
  if (checkLiked) {
    throw new BusinessError("Bạn đã thích truyện này rồi");
  }

  const manga = await MangaModel.findByIdAndUpdate(mangaId, { $inc: { likeNumber: 1 } });
  if (!manga) {
    throw new BusinessError("Truyện không tồn tại");
  }

  await UserModel.findByIdAndUpdate(userId, { $push: { likedManga: mangaId } });

  return {
    success: true,
    message: "Thích truyện thành công",
  };
};

export const unlikeManga = async (request: Request, mangaId: string) => {
  const userId = await getUserId(request);
  if (!userId) {
    throw new BusinessError("Bạn cần đăng nhập để bỏ thích truyện");
  }

  const checkLiked = await UserModel.findOne({ _id: userId, likedManga: mangaId });
  if (!checkLiked) {
    throw new BusinessError("Bạn chưa thích truyện này");
  }

  await UserModel.findByIdAndUpdate(userId, { $pull: { likedManga: mangaId } });

  await MangaModel.findByIdAndUpdate(mangaId, { $inc: { likeNumber: -1 } });

  return {
    success: true,
    message: "Bỏ thích truyện thành công",
  };
};

export const deleteManga = async (request: Request, mangaId: string) => {
  const userId = await getUserId(request);
  if (!userId) {
    throw new BusinessError("Bạn cần đăng nhập để xóa truyện");
  }

  const user = await UserModel.findById(userId);
  if (user?.role !== ROLES.ADMIN) {
    throw new BusinessError("Bạn không có quyền xóa truyện");
  }

  await MangaModel.findByIdAndDelete(mangaId);

  return {
    success: true,
    message: "Xóa truyện thành công",
  };
};
