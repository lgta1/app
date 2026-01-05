import { model, Schema } from "mongoose";

export type UserFollowTranslatorType = {
  id: string;
  userId: string;
  translatorSlug: string;
};

const UserFollowTranslatorSchema = new Schema<UserFollowTranslatorType>(
  {
    userId: { type: String, ref: "User", required: true },
    translatorSlug: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: false },
);

UserFollowTranslatorSchema.index({ userId: 1, translatorSlug: 1 }, { unique: true });

export const UserFollowTranslatorModel = model("UserFollowTranslator", UserFollowTranslatorSchema);
