import { model, Schema } from "mongoose";

export type UserFollowAuthorType = {
  id: string;
  userId: string;
  authorSlug: string;
};

const UserFollowAuthorSchema = new Schema<UserFollowAuthorType>(
  {
    userId: { type: String, ref: "User", required: true },
    authorSlug: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: false },
);

UserFollowAuthorSchema.index({ userId: 1, authorSlug: 1 }, { unique: true });

export const UserFollowAuthorModel = model("UserFollowAuthor", UserFollowAuthorSchema);
