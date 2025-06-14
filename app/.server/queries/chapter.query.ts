import { ChapterModel } from "~/database/models/chapter.model";

export const getChaptersByMangaId = async (mangaId: string) => {
  return await ChapterModel.find({ mangaId }).sort({ createdAt: -1 }).lean();
};

export const getChaptersByMangaIdAndNumber = async (
  mangaId: string,
  chapterNumber: number,
) => {
  return await ChapterModel.findOne({ mangaId, chapterNumber }).lean();
};

export const getChapterById = async (id: string) => {
  return await ChapterModel.findById(id).lean();
};
