import { model, Schema } from "mongoose";
import { autoIncrement } from "mongoose-plugin-autoinc";

import { MANGA_CONTENT_TYPE, MANGA_STATUS, MANGA_USER_STATUS, type MangaContentType } from "~/constants/manga";

export type MangaType = {
  id: string;
  slug: string;
  code?: number;
  title: string;
  alternateTitle?: string;
  description: string;
  poster: string;
  shareImage?: string;
  chapters: number;
  author?: string; // optional per new requirement
  // New optional relations (denormalized) - authors
  authorNames?: string[];
  authorSlugs?: string[];
  status: number;
  userStatus: number;
  genres: string[];
  // New optional relations (denormalized)
  doujinshiNames?: string[];
  doujinshiSlugs?: string[];
  translatorNames?: string[];
  translatorSlugs?: string[];
  characterNames?: string[];
  characterSlugs?: string[];
  likeNumber?: number;
  viewNumber?: number;
  dailyViews?: number;
  weeklyViews?: number;
  monthlyViews?: number;
  followNumber?: number;
  translationTeam: string;
  ownerId: string;
  keywords?: string;
  contentType: MangaContentType;
  createdAt: Date;
  updatedAt: Date;
};

const MangaSchema = new Schema<MangaType>(
  {
    code: { type: Number, unique: true },
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    alternateTitle: { type: String },
    description: { type: String, default: "" },
    poster: { type: String, required: true },
    shareImage: { type: String },
    chapters: { type: Number, default: 0 },
    author: { type: String },
    authorNames: { type: [String], default: [] },
    authorSlugs: { type: [String], index: true, default: [] },
    status: { type: Number, enum: MANGA_STATUS, default: MANGA_STATUS.PENDING },
    userStatus: {
      type: Number,
      enum: MANGA_USER_STATUS,
      default: MANGA_USER_STATUS.ON_GOING,
    },
    genres: { type: [String], required: true },
    doujinshiNames: { type: [String], default: [] },
    doujinshiSlugs: { type: [String], index: true, default: [] },
    translatorNames: { type: [String], default: [] },
    translatorSlugs: { type: [String], index: true, default: [] },
    characterNames: { type: [String], default: [] },
    characterSlugs: { type: [String], index: true, default: [] },
    likeNumber: { type: Number, default: 0 },
    viewNumber: { type: Number, default: 0 },
    dailyViews: { type: Number, default: 0 },
    weeklyViews: { type: Number, default: 0 },
    monthlyViews: { type: Number, default: 0 },
    followNumber: { type: Number, default: 0 },
    translationTeam: { type: String, required: true },
    ownerId: { type: String, required: true },
    keywords: { type: String },
    contentType: {
      type: String,
      enum: Object.values(MANGA_CONTENT_TYPE),
      default: MANGA_CONTENT_TYPE.MANGA,
      index: true,
    },
  },
  { timestamps: true },
);

// Cấu hình auto-increment cho trường code bắt đầu từ 100000
MangaSchema.plugin(autoIncrement, {
  model: "Manga",
  field: "code",
  startAt: 100000,
  incrementBy: 1,
});

// Text index cho search functionality — include alternateTitle and keywords
// Give higher weight to title, slightly lower to alternateTitle and keywords
MangaSchema.index(
  {
    title: "text",
    alternateTitle: "text",
    keywords: "text",
    characterNames: "text",
    doujinshiNames: "text",
    author: "text",
    translatorNames: "text",
    translationTeam: "text",
  },
  {
    weights: {
      title: 10,
      alternateTitle: 8,
      keywords: 5,
      characterNames: 5,
      doujinshiNames: 5,
      author: 4,
      translatorNames: 3,
      translationTeam: 3,
    },
  },
);

// Compound index cho approved manga với pagination
MangaSchema.index({ status: 1, createdAt: -1 });
// Thêm index phục vụ trang "Truyện mới cập nhật" sort theo updatedAt desc
MangaSchema.index({ status: 1, updatedAt: -1 });

// Compound indexes for genre page sorting/filtering
// - Default & completed: sort by updatedAt desc
MangaSchema.index({ status: 1, genres: 1, updatedAt: -1 });
MangaSchema.index({ status: 1, genres: 1, userStatus: 1, updatedAt: -1 });
// - Sort by view and like counts within a genre
MangaSchema.index({ status: 1, genres: 1, viewNumber: -1 });
MangaSchema.index({ status: 1, genres: 1, likeNumber: -1 });
// Index for daily leaderboard sorting
MangaSchema.index({ status: 1, dailyViews: -1, updatedAt: -1 });
// Indexes for weekly/monthly views sorting
MangaSchema.index({ status: 1, weeklyViews: -1, updatedAt: -1 });
MangaSchema.index({ status: 1, monthlyViews: -1, updatedAt: -1 });

// Index cho uploaded manga by owner
MangaSchema.index({ ownerId: 1, createdAt: -1 });

// Index cho related manga by genres
MangaSchema.index({ genres: 1 });
// Indexes for new relations (already set via path index:true but add compound for approved filter)
MangaSchema.index({ status: 1, doujinshiSlugs: 1, updatedAt: -1 });
MangaSchema.index({ status: 1, translatorSlugs: 1, updatedAt: -1 });
MangaSchema.index({ status: 1, characterSlugs: 1, updatedAt: -1 });
MangaSchema.index({ status: 1, authorSlugs: 1, updatedAt: -1 });

export const MangaModel = model("Manga", MangaSchema);
