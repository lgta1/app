import { model, Schema } from "mongoose";

import type { ReactionType } from "~/constants/reactions";

export type UserReactionCommentType = {
  id: string;
  commentId: string;
  userId: string;
  reaction: ReactionType;
};

const UserReactionCommentSchema = new Schema<UserReactionCommentType>(
  {
    commentId: { type: String, ref: "Comment", required: true },
    userId: { type: String, ref: "User", required: true },
    reaction: { type: String, required: true },
  },
  { timestamps: false },
);

UserReactionCommentSchema.index({ commentId: 1, userId: 1 }, { unique: true });
UserReactionCommentSchema.index({ commentId: 1, reaction: 1 });

export const UserReactionCommentModel = model("UserReactionComment", UserReactionCommentSchema);
