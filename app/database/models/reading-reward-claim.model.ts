import { model, Schema } from "mongoose";

export type ReadingRewardClaimType = {
  id: string;
  userId: string;
  chapterId: string;
  date: string; // YYYY-MM-DD (Asia/Ho_Chi_Minh)
  granted: boolean;
  gold: number;
  createdAt: Date;
  updatedAt: Date;
};

const ReadingRewardClaimSchema = new Schema<ReadingRewardClaimType>(
  {
    userId: { type: String, required: true, ref: "User" },
    chapterId: { type: String, required: true, ref: "Chapter" },
    date: { type: String, required: true },
    granted: { type: Boolean, required: true },
    gold: { type: Number, required: true },
  },
  { timestamps: true },
);

// Mỗi chapter chỉ claim 1 lần / user
ReadingRewardClaimSchema.index({ userId: 1, chapterId: 1 }, { unique: true });
ReadingRewardClaimSchema.index({ userId: 1, date: 1 });

export const ReadingRewardClaimModel = model("ReadingRewardClaim", ReadingRewardClaimSchema);
