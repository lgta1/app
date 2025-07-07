import { model, Schema } from "mongoose";

export type MangaRatingType = {
  id: string;
  userId: string;
  mangaId: string;
  rating: number; // 1-5 stars
  createdAt: Date;
};

const MangaRatingSchema = new Schema<MangaRatingType>(
  {
    userId: { type: String, ref: "User", required: true },
    mangaId: { type: String, ref: "Manga", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
  },
  { timestamps: true },
);

// Unique index để đảm bảo mỗi user chỉ rating 1 lần cho 1 manga
MangaRatingSchema.index({ userId: 1, mangaId: 1 }, { unique: true });

// Index để query rating theo manga
MangaRatingSchema.index({ mangaId: 1 });

export const MangaRatingModel = model("MangaRating", MangaRatingSchema);
