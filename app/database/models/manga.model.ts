import { model, Schema } from "mongoose";

export type MangaType = {
  id: string;
  title: string;
  description: string;
  poster: string;
  chapters: number;
  author: string;
  status: string;
  genres: string[];
  likeNumber: number;
  viewNumber: number;
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
    status: { type: String, required: true },
    genres: { type: [String], required: true },
    likeNumber: { type: Number, default: 0 },
    viewNumber: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const MangaModel = model("Manga", MangaSchema);
