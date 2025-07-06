import { model, Schema } from "mongoose";

export type UserLikePostType = {
  id: string;
  postId: string;
  userId: string;
};

const UserLikePostSchema = new Schema<UserLikePostType>(
  {
    postId: { type: String, ref: "Post", required: true },
    userId: { type: String, ref: "User", required: true },
  },
  { timestamps: false },
);

UserLikePostSchema.index({ postId: 1, userId: 1 }, { unique: true });

export const UserLikePostModel = model("UserLikePost", UserLikePostSchema);
