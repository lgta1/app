import { ChapterModel } from "~/database/models/chapter.model";

export const getChapterByMangaId = async (mangaId: string) => {
  return await ChapterModel.find({ mangaId }).sort({ createdAt: -1 }).lean();
};
