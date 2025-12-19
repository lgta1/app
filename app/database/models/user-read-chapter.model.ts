import { model, Schema, Types } from "mongoose";

export type UserReadChapterType = {
  id: string;
  chapterId: Types.ObjectId;   // 🔧 Dùng ObjectId để join với chapters._id
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};

const UserReadChapterSchema = new Schema<UserReadChapterType>(
  {
    chapterId: { type: Schema.Types.ObjectId, ref: "Chapter", required: true, index: true }, // 🔧
    userId: { type: String, ref: "User", required: true, index: true },
  },
  { timestamps: true }, // có createdAt/updatedAt
);

// Unique mỗi (user, chapter)
UserReadChapterSchema.index({ userId: 1, chapterId: 1 }, { unique: true });

// Truy vấn lịch sử nhanh theo thời gian
UserReadChapterSchema.index({ userId: 1, updatedAt: -1 });

export const UserReadChapterModel = model<UserReadChapterType>("UserReadChapter", UserReadChapterSchema);
