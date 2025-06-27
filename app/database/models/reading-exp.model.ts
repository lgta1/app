import { model, Schema } from "mongoose";

export type ReadingExpType = {
  id: string;
  userId: string;
  date: string; // Format: YYYY-MM-DD để track theo ngày
  chaptersRead: number; // Số chapter đã đọc trong ngày
  totalExp: number; // Tổng exp đã nhận trong ngày
  createdAt: Date;
  updatedAt: Date;
};

const ReadingExpSchema = new Schema<ReadingExpType>(
  {
    userId: { type: String, required: true, ref: "User" },
    date: { type: String, required: true }, // YYYY-MM-DD format
    chaptersRead: { type: Number, default: 0 },
    totalExp: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Index để query nhanh
ReadingExpSchema.index({ userId: 1, date: 1 }, { unique: true });

export const ReadingExpModel = model("ReadingExp", ReadingExpSchema);
