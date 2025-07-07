import { model, Schema } from "mongoose";

export type MangaRevenueType = {
  id: string;
  mangaId: string;
  revenue: number;
  period: "daily" | "weekly" | "monthly";
  createdAt: Date;
  updatedAt: Date;
};

const MangaRevenueSchema = new Schema<MangaRevenueType>(
  {
    mangaId: { type: String, required: true, ref: "Manga" },
    revenue: { type: Number, required: true },
    period: { type: String, enum: ["daily", "weekly", "monthly"], required: true },
  },
  { timestamps: true },
);

// Index cho query theo period và sort theo revenue
MangaRevenueSchema.index({ period: 1, revenue: -1 });

export const MangaRevenueModel = model("MangaRevenue", MangaRevenueSchema);
