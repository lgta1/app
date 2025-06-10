import { model, Schema } from "mongoose";

export type UserLikeCommentType = {
  id: string;
  commentId: string;
  userId: string;
};

const UserLikeCommentSchema = new Schema<UserLikeCommentType>(
  {
    commentId: { type: String, ref: "Comment", required: true },
    userId: { type: String, ref: "User", required: true },
  },
  { timestamps: false },
);

UserLikeCommentSchema.index({ commentId: 1, userId: 1 }, { unique: true });

export const UserLikeCommentModel = model("UserLikeComment", UserLikeCommentSchema);
