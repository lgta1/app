import { getUserInfoFromSession } from "@/services/session.svc";

import { CHAPTER_STATUS } from "~/constants/chapter";
import { ChapterModel, type ChapterType } from "~/database/models/chapter.model";
import { MangaModel } from "~/database/models/manga.model";
import { BusinessError } from "~/helpers/errors.helper";
import { isAdmin } from "~/helpers/user.helper";

export const createChapter = async (
  request: Request,
  chapter: Omit<ChapterType, "id" | "createdAt" | "updatedAt">,
) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  let query: any = {
    _id: chapter.mangaId,
  };

  if (!isAdmin(userInfo.role)) {
    query = {
      ...query,
      ownerId: userInfo.id,
    };
  }

  const manga = await MangaModel.findOneAndUpdate(
    query,
    {
      $inc: { chapters: 1 },
    },
    { new: true },
  );

  if (!manga) {
    throw new BusinessError("Không tìm thấy manga");
  }
  try {
    const newChapter = await ChapterModel.create({
      ...chapter,
      chapterNumber: manga.chapters,
    });

    return newChapter;
  } catch (error) {
    manga.chapters--;
    await manga.save();
    throw new BusinessError("Lỗi khi tạo chương");
  }
};

export const updateChapter = async (
  request: Request,
  mangaId: string,
  chapterNumber: number,
  updateData: Partial<Pick<ChapterType, "title" | "contentUrls">>,
) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  let query: any = {
    _id: mangaId,
  };

  if (!isAdmin(userInfo.role)) {
    query = {
      ...query,
      ownerId: userInfo.id,
    };
  }

  // Verify manga ownership
  const manga = await MangaModel.findOne(query);
  if (!manga) {
    throw new BusinessError("Không tìm thấy manga hoặc bạn không có quyền chỉnh sửa");
  }

  // Update chapter
  const updatedChapter = await ChapterModel.findOneAndUpdate(
    { mangaId, chapterNumber },
    {
      ...updateData,
      status: CHAPTER_STATUS.PENDING,
    },
    { new: true },
  );

  if (!updatedChapter) {
    throw new BusinessError("Không tìm thấy chương");
  }

  return updatedChapter;
};
