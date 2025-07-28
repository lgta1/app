import { model, Schema } from "mongoose";
import { autoIncrement } from "mongoose-plugin-autoinc";

import { MANGA_STATUS, MANGA_USER_STATUS } from "~/constants/manga";

export type MangaType = {
  id: string;
  code?: number;
  title: string;
  description: string;
  poster: string;
  chapters: number;
  author: string;
  status: number;
  userStatus: number;
  genres: string[];
  likeNumber?: number;
  viewNumber?: number;
  followNumber?: number;
  ratingAverage?: number;
  ratingCount?: number;
  translationTeam: string;
  ownerId: string;
  keywords?: string;
  createdAt: Date;
  updatedAt: Date;
};

const MangaSchema = new Schema<MangaType>(
  {
    code: { type: Number, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    poster: { type: String, required: true },
    chapters: { type: Number, default: 0 },
    author: { type: String, required: true },
    status: { type: Number, enum: MANGA_STATUS, default: MANGA_STATUS.PENDING },
    userStatus: {
      type: Number,
      enum: MANGA_USER_STATUS,
      default: MANGA_USER_STATUS.ON_GOING,
    },
    genres: { type: [String], required: true },
    likeNumber: { type: Number, default: 0 },
    viewNumber: { type: Number, default: 0 },
    followNumber: { type: Number, default: 0 },
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    translationTeam: { type: String, required: true },
    ownerId: { type: String, required: true },
    keywords: { type: String },
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

// Text index cho search functionality
MangaSchema.index({ title: "text" });

// Compound index cho approved manga với pagination
MangaSchema.index({ status: 1, createdAt: -1 });

// Index cho uploaded manga by owner
MangaSchema.index({ ownerId: 1, createdAt: -1 });

// Index cho related manga by genres
MangaSchema.index({ genres: 1 });

export const MangaModel = model("Manga", MangaSchema);
