import { model, Schema } from "mongoose";

import type { ChapterReaction } from "~/constants/chapter-rating";

export type UserChapterReactionType = {
  id: string;
  userId: string;
  chapterId: string;
  reaction: ChapterReaction;
  createdAt: Date;
  updatedAt: Date;
};

const UserChapterReactionSchema = new Schema<UserChapterReactionType>(
  {
    userId: { type: String, required: true, index: true },
    chapterId: { type: String, required: true, index: true },
    reaction: { type: String, enum: ["like", "dislike"], required: true },
  },
  { timestamps: true },
);

// 1 user chỉ vote 1 lần / chap (có thể đổi reaction)
UserChapterReactionSchema.index({ userId: 1, chapterId: 1 }, { unique: true });

export const UserChapterReactionModel = model("UserChapterReaction", UserChapterReactionSchema);
