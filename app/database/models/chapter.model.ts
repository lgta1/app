import { model, Schema } from "mongoose";

import { CHAPTER_STATUS } from "~/constants/chapter";

export type ChapterType = {
  id: string;
  title: string;
  thumbnail: string;
  viewNumber?: number;
  likeNumber?: number;
  commentNumber?: number;
  chapterNumber?: number;
  contentUrls: string[];
  mangaId: string;
  status?: number;
  createdAt: Date;
  updatedAt: Date;
};

const ChapterSchema = new Schema<ChapterType>(
  {
    title: { type: String, required: true },
    thumbnail: { type: String, required: true },
    viewNumber: { type: Number, default: 0 },
    likeNumber: { type: Number, default: 0 },
    commentNumber: { type: Number, default: 0 },
    chapterNumber: { type: Number, required: true },
    contentUrls: { type: [String], required: true },
    mangaId: { type: String, required: true, ref: "Manga" },
    status: { type: Number, enum: CHAPTER_STATUS, default: CHAPTER_STATUS.PENDING },
  },
  { timestamps: true },
);

ChapterSchema.index({ mangaId: 1 });

export const ChapterModel = model("Chapter", ChapterSchema);
