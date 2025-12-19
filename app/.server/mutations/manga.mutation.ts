import { getUserInfoFromSession } from "@/services/session.svc";
import { generateMangaShareImage } from "@/services/share-image.svc";

import { MANGA_CONTENT_TYPE, MANGA_STATUS, MANGA_USER_STATUS, type MangaContentType } from "~/constants/manga";
import { ChapterModel } from "~/database/models/chapter.model";
import { CommentModel } from "~/database/models/comment.model";
import { generateUniqueMangaSlug, resolveMangaHandle } from "~/database/helpers/manga-slug.helper";
import { MangaModel, type MangaType } from "~/database/models/manga.model";
import { UserModel } from "~/database/models/user.model";
import { AdminActionLogModel } from "~/database/models/admin-action-log.model";
import { UserFollowMangaModel } from "~/database/models/user-follow-manga.model";
import { UserLikeMangaModel } from "~/database/models/user-like-manga.model";
import { UserReadChapterModel } from "~/database/models/user-read-chapter.model";
import { BusinessError } from "~/helpers/errors.helper";
import { isAdmin, isDichGia } from "~/helpers/user.helper";

const resolveMangaMutationTarget = async (handle: string) => {
  if (!handle) return null;
  const doc = await resolveMangaHandle(handle);
  if (!doc) return null;
  const targetId = String((doc as any)._id ?? (doc as any).id ?? "");
  if (!targetId) return null;
  return { doc, targetId };
};

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
  manga: Omit<MangaType, "id" | "slug" | "createdAt" | "updatedAt" | "chapters" | "status"> & {
    contentType?: MangaContentType;
  },
) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để tạo truyện");
  }
  if (!Object.values(MANGA_USER_STATUS).includes(manga.userStatus)) {
    throw new BusinessError("Truyện không được tạo với trạng thái này");
  }
  const isAdminUser = isAdmin(userInfo.role);
  // Auto approve nếu là dịch giả và là owner (ownerId đã gắn = userInfo.id ở layer gọi)
  const shouldAutoApprove = isDichGia(userInfo.role) && String(manga.ownerId) === String(userInfo.id);
  const requestedContentType = manga.contentType;
  const resolvedContentType =
    isAdminUser && requestedContentType === MANGA_CONTENT_TYPE.COSPLAY
      ? MANGA_CONTENT_TYPE.COSPLAY
      : MANGA_CONTENT_TYPE.MANGA;

  const slug = await generateUniqueMangaSlug(manga.title);

  const doc = await MangaModel.create({
    ...manga,
    contentType: resolvedContentType,
    slug,
    ...(shouldAutoApprove ? { status: MANGA_STATUS.APPROVED } : {}),
  });

  try {
    const shareImage = await generateMangaShareImage({
      mangaId: String(doc._id),
      title: manga.title,
      posterUrl: manga.poster,
    });

    if (shareImage) {
      await MangaModel.findByIdAndUpdate(doc._id, { shareImage }, { timestamps: false });
      (doc as any).shareImage = shareImage;
    }
  } catch (error) {
    console.error("[createManga] Không thể tạo ảnh chia sẻ", error);
  }

  if (shouldAutoApprove) {
    try {
      await AdminActionLogModel.create({
        action: 'AUTO_APPROVE_DICHGIA',
        adminId: userInfo.id, // ghi lại user thực hiện (dịch giả)
        mangaId: String(doc._id),
      } as any);
    } catch (e) {
      console.warn('[createManga] log auto approve failed', e);
    }
  }

  return doc;
};

export const updateManga = async (
  request: Request,
  id: string,
  data: Partial<Omit<MangaType, "_id" | "id" | "slug" | "createdAt" | "updatedAt" | "chapters">>,
) => {
  let userInfo: Awaited<ReturnType<typeof getUserInfoFromSession>> | null = null;
  try {
    userInfo = await getUserInfoFromSession(request);
  } catch {
    userInfo = null;
  }
  const canEditContentType = !!userInfo && isAdmin(userInfo.role);
  const manga = await MangaModel.findById(id);

  if (!manga) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  const payload: Record<string, any> = { ...data };
  if ("contentType" in payload) {
    if (canEditContentType) {
      payload.contentType =
        payload.contentType === MANGA_CONTENT_TYPE.COSPLAY
          ? MANGA_CONTENT_TYPE.COSPLAY
          : MANGA_CONTENT_TYPE.MANGA;
    } else {
      delete payload.contentType;
    }
  }
  const posterSource = data.poster || manga.poster;
  const titleSource = data.title || manga.title;
  const needsShareImage = Boolean(
    (posterSource && !manga.shareImage) ||
      (data.poster && data.poster !== manga.poster) ||
      (data.title && !!manga.shareImage),
  );

  if (needsShareImage && posterSource) {
    try {
      const shareImage = await generateMangaShareImage({
        mangaId: id,
        title: titleSource,
        posterUrl: posterSource,
      });

      if (shareImage) {
        payload.shareImage = shareImage;
      }
    } catch (error) {
      console.error("[updateManga] Không thể tạo ảnh chia sẻ", error);
    }
  }

  // Không cập nhật updatedAt khi chỉ sửa metadata
  await MangaModel.findByIdAndUpdate(id, { $set: payload }, { timestamps: false });
};

export const submitMangaToReview = async (request: Request, mangaId: string) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để nộp truyện");
  }

  const resolved = await resolveMangaMutationTarget(mangaId);
  if (!resolved) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  if (String((resolved.doc as any).ownerId) !== String(userInfo.id)) {
    throw new BusinessError("Bạn không có quyền nộp truyện này");
  }

  if ((resolved.doc as any).status === MANGA_STATUS.APPROVED) {
    throw new BusinessError("Truyện đã được duyệt");
  }

  await MangaModel.findByIdAndUpdate(
    resolved.targetId,
    { $set: { status: MANGA_STATUS.PENDING } },
    { timestamps: false },
  );

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

  const resolved = await resolveMangaMutationTarget(mangaId);
  if (!resolved) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  await MangaModel.findByIdAndUpdate(
    resolved.targetId,
    { $set: { status: MANGA_STATUS.APPROVED } },
    { timestamps: false },
  );

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

  const resolved = await resolveMangaMutationTarget(mangaId);
  if (!resolved) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  await MangaModel.findByIdAndUpdate(
    resolved.targetId,
    { $set: { status: MANGA_STATUS.REJECTED } },
    { timestamps: false },
  );

  return {
    success: true,
    message: "Từ chối truyện thành công",
  };
};

export const transferMangaOwner = async (request: Request, mangaId: string, newOwnerId: string) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để chuyển quyền truyện");
  }

  // Chỉ ADMIN (không cho MOD) theo yêu cầu "admin cấp cao".
  if (userInfo.role !== 'ADMIN') {
    throw new BusinessError("Bạn không có quyền chuyển quyền truyện");
  }

  if (!newOwnerId || typeof newOwnerId !== 'string') {
    throw new BusinessError("ID người nhận mới không hợp lệ");
  }

  const manga = await MangaModel.findById(mangaId);
  if (!manga) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  if (String(manga.ownerId) === String(newOwnerId)) {
    throw new BusinessError("Người nhận đã là chủ sở hữu hiện tại");
  }

  const newOwner = await UserModel.findById(newOwnerId).select('_id role isDeleted isBanned');
  if (!newOwner || newOwner.isDeleted || newOwner.isBanned) {
    throw new BusinessError("Người nhận mới không tồn tại hoặc không hợp lệ");
  }

  const oldOwnerId = manga.ownerId;

  // Cập nhật chủ sở hữu
  await MangaModel.findByIdAndUpdate(mangaId, { $set: { ownerId: newOwnerId } }, { timestamps: false });

  // Cập nhật thống kê số lượng truyện của user
  await Promise.all([
    UserModel.findByIdAndUpdate(oldOwnerId, { $inc: { mangasCount: -1 } }),
    UserModel.findByIdAndUpdate(newOwnerId, { $inc: { mangasCount: 1 } }),
  ]);

  // Ghi log hành động admin
  try {
    await AdminActionLogModel.create({
      action: 'TRANSFER_MANGA_OWNER',
      adminId: userInfo.id,
      mangaId: String(mangaId),
      oldOwnerId: String(oldOwnerId),
      newOwnerId: String(newOwnerId),
    });
  } catch (e) {
    console.error('[transferMangaOwner] Cannot write admin action log', e);
  }

  return {
    success: true,
    message: 'Chuyển quyền truyện thành công',
    oldOwnerId: String(oldOwnerId),
    newOwnerId: String(newOwnerId),
  };
};
