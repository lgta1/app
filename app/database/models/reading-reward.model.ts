import { model, Schema } from "mongoose";

export type ReadingRewardType = {
  id: string;
  userId: string;
  date: string; // Format: YYYY-MM-DD để track theo ngày
  rewardCount: number; // Số lần đã nhận vàng trong ngày
  createdAt: Date;
  updatedAt: Date;
};

const ReadingRewardSchema = new Schema<ReadingRewardType>(
  {
    userId: { type: String, required: true, ref: "User" },
    date: { type: String, required: true }, // YYYY-MM-DD format
    rewardCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Index để query nhanh
ReadingRewardSchema.index({ userId: 1, date: 1 }, { unique: true });

export const ReadingRewardModel = model("ReadingReward", ReadingRewardSchema);
