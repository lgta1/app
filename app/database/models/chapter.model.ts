import { model, Schema } from "mongoose";

import { CHAPTER_STATUS } from "~/constants/chapter";

export type ChapterType = {
  id: string;
  title: string;
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

// Index tối ưu cho các query patterns
ChapterSchema.index({ mangaId: 1, chapterNumber: 1 }, { unique: true }); // Unique lookup và prevent duplicate
ChapterSchema.index({ mangaId: 1, createdAt: -1 }); // List chapters của manga theo thời gian

export const ChapterModel = model("Chapter", ChapterSchema);
