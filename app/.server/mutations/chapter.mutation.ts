import { getUserInfoFromSession } from "@/services/session.svc";

import { CHAPTER_STATUS } from "~/constants/chapter";
import { MANGA_STATUS } from "~/constants/manga";
import { ChapterModel, type ChapterType } from "~/database/models/chapter.model";
import { MangaModel } from "~/database/models/manga.model";
import { BusinessError } from "~/helpers/errors.helper";

export const createChapter = async (
  request: Request,
  chapter: Omit<ChapterType, "id" | "createdAt" | "updatedAt">,
) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  const manga = await MangaModel.findOneAndUpdate(
    { _id: chapter.mangaId, ownerId: userInfo.id },
    {
      $inc: { chapters: 1 },
      $set: { status: MANGA_STATUS.CREATING },
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
  updateData: Partial<Pick<ChapterType, "title" | "thumbnail" | "contentUrls">>,
) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  // Verify manga ownership
  const manga = await MangaModel.findOneAndUpdate(
    { _id: mangaId, ownerId: userInfo.id },
    { $set: { status: MANGA_STATUS.CREATING } },
    { new: true },
  );
  if (!manga) {
    throw new BusinessError("Không tìm thấy manga hoặc bạn không có quyền chỉnh sửa");
  }

  // Update chapter
  const updatedChapter = await ChapterModel.findOneAndUpdate(
    { mangaId, chapterNumber },
    {
      ...updateData,
      status: CHAPTER_STATUS.PENDING, // Set status to waiting for review
    },
    { new: true },
  );

  if (!updatedChapter) {
    throw new BusinessError("Không tìm thấy chương");
  }

  // Update manga status to waiting
  await MangaModel.findByIdAndUpdate(mangaId, { status: MANGA_STATUS.CREATING });

  return updatedChapter;
};
