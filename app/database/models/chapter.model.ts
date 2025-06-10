import { model, Schema } from "mongoose";

export type ChapterType = {
  id: string;
  title: string;
  thumbnail: string;
  viewNumber: number;
  likeNumber: number;
  commentNumber: number;
  mangaId: string;
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
    mangaId: { type: String, required: true, ref: "Manga" },
  },
  { timestamps: true },
);

ChapterSchema.index({ mangaId: 1 });

export const ChapterModel = model("Chapter", ChapterSchema);
