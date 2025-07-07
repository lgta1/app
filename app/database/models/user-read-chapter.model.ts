import { model, Schema } from "mongoose";

export type UserReadChapterType = {
  id: string;
  chapterId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};

const UserReadChapterSchema = new Schema<UserReadChapterType>(
  {
    chapterId: { type: String, ref: "Chapter", required: true },
    userId: { type: String, ref: "User", required: true },
  },
  { timestamps: true },
);

UserReadChapterSchema.index({ chapterId: 1, userId: 1 }, { unique: true });

UserReadChapterSchema.index({ userId: 1, createdAt: -1 });

export const UserReadChapterModel = model("UserReadChapter", UserReadChapterSchema);
