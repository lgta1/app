import { model, Schema } from "mongoose";

import { MANGA_STATUS } from "~/constants/manga";

export type MangaType = {
  id: string;
  title: string;
  description: string;
  poster: string;
  chapters: number;
  author: string;
  status: number;
  genres: string[];
  likeNumber: number;
  viewNumber: number;
  revenue: number;
  createdAt: Date;
  updatedAt: Date;
};

const MangaSchema = new Schema<MangaType>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    poster: { type: String, required: true },
    chapters: { type: Number, required: true },
    author: { type: String, required: true },
    status: { type: Number, enum: MANGA_STATUS, default: MANGA_STATUS.PENDING },
    genres: { type: [String], required: true },
    likeNumber: { type: Number, default: 0 },
    viewNumber: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const MangaModel = model("Manga", MangaSchema);
