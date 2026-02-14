import { model, Schema } from "mongoose";

import { CHAPTER_STATUS } from "~/constants/chapter";

export type ChapterType = {
  id: string;
  title: string;
  /** Stable SEO slug for chapter URL (generated once, never changes). */
  slug?: string;
  /** Idempotency key for chapter creation. */
  requestId?: string;
  /** Source chapter URL on upstream site (used for sync/dedup). */
  sourceChapterUrl?: string;
  viewNumber?: number;
  likeNumber?: number;
  dislikeNumber?: number;
  chapScore?: number;
  commentNumber?: number;
  chapterNumber?: number;
  contentUrls: string[];
  contentBytes?: number;
  publishAt?: Date;
  publishedAt?: Date;
  mangaId: string;
  status?: number;
  createdAt: Date;
  updatedAt?: Date;
};

const ChapterSchema = new Schema<ChapterType>(
  {
    title: { type: String, required: true },
    slug: { type: String, default: "" },
    requestId: { type: String },
    sourceChapterUrl: { type: String },
    viewNumber: { type: Number, default: 0 },
    likeNumber: { type: Number, default: 0 },
    dislikeNumber: { type: Number, default: 0 },
    chapScore: { type: Number, default: 0 },
    commentNumber: { type: Number, default: 0 },
    chapterNumber: { type: Number, required: true },
    contentUrls: { type: [String], required: true },
    contentBytes: { type: Number, default: 0 },
    publishAt: { type: Date },
    publishedAt: { type: Date },
    mangaId: { type: String, required: true, ref: "Manga" },
    status: { type: Number, enum: CHAPTER_STATUS, default: CHAPTER_STATUS.PENDING },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Index tối ưu cho các query patterns
ChapterSchema.index({ mangaId: 1, chapterNumber: 1 }, { unique: true }); // Unique lookup và prevent duplicate
ChapterSchema.index({ mangaId: 1, slug: 1 }, { unique: true, sparse: true }); // Stable SEO URL per manga
ChapterSchema.index({ mangaId: 1, requestId: 1 }, { unique: true, sparse: true }); // Idempotency key for create
ChapterSchema.index({ mangaId: 1, sourceChapterUrl: 1 }, { unique: true, sparse: true }); // Upstream URL dedup/sync
ChapterSchema.index({ mangaId: 1, createdAt: -1 }); // List chapters của manga theo thời gian
ChapterSchema.index({ status: 1, publishAt: 1 }); // Scheduled publish scan
ChapterSchema.index({ mangaId: 1, status: 1, chapterNumber: -1 }); // Public chapter listing

export const ChapterModel = model("Chapter", ChapterSchema);
