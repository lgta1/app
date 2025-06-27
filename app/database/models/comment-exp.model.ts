import { model, Schema } from "mongoose";

export type CommentExpType = {
  id: string;
  userId: string;
  date: string; // Format: YYYY-MM-DD để track theo ngày
  commentsPosted: number; // Số comment đã đăng trong ngày
  totalExp: number; // Tổng exp đã nhận từ comment trong ngày
  createdAt: Date;
  updatedAt: Date;
};

const CommentExpSchema = new Schema<CommentExpType>(
  {
    userId: { type: String, required: true, ref: "User" },
    date: { type: String, required: true }, // YYYY-MM-DD format
    commentsPosted: { type: Number, default: 0 },
    totalExp: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Index để query nhanh
CommentExpSchema.index({ userId: 1, date: 1 }, { unique: true });

export const CommentExpModel = model("CommentExp", CommentExpSchema);
