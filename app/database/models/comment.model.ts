import { model, Schema } from "mongoose";

import type { ReactionCounts } from "~/constants/reactions";

export type CommentType = {
  id: string;
  content: string;
  mangaId?: string;
  postId?: string;
  userId: string;
  parentId?: string;
  likeNumber: number;
  reactionCounts?: ReactionCounts;
  totalReactions?: number;
  createdAt: Date;
  updatedAt: Date;
};

const CommentSchema = new Schema<CommentType>(
  {
    content: { type: String, required: true, trim: true },
    mangaId: { type: String, ref: "Manga", required: false },
    postId: { type: String, ref: "Post", required: false },
    userId: { type: String, ref: "User", required: true },
    parentId: { type: String, ref: "Comment", required: false },
    likeNumber: { type: Number, default: 0 },
    reactionCounts: {
      like: { type: Number, default: 0 },
      love: { type: Number, default: 0 },
      care: { type: Number, default: 0 },
      haha: { type: Number, default: 0 },
      wow: { type: Number, default: 0 },
      sad: { type: Number, default: 0 },
      angry: { type: Number, default: 0 },
    },
    totalReactions: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Validation để đảm bảo ít nhất một trong mangaId hoặc postId phải có
CommentSchema.pre("save", function () {
  if (!this.mangaId && !this.postId) {
    throw new Error("Comment must have either mangaId or postId");
  }
  if (this.mangaId && this.postId) {
    throw new Error("Comment cannot have both mangaId and postId");
  }
});

// Index tối ưu hóa cho các query patterns thực tế
CommentSchema.index({ mangaId: 1, parentId: 1, createdAt: -1 }); // Query parent comments và replies theo mangaId
CommentSchema.index({ postId: 1, parentId: 1, createdAt: -1 }); // Query parent comments và replies theo postId
CommentSchema.index({ userId: 1, createdAt: -1 }); // Query comments theo user
CommentSchema.index({ parentId: 1, createdAt: 1 }); // Query replies của một comment (sort tăng dần)

export const CommentModel = model("Comment", CommentSchema);
