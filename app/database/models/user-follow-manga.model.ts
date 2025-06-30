import { model, Schema } from "mongoose";

export type UserFollowMangaType = {
  id: string;
  userId: string;
  mangaId: string;
};

const UserFollowMangaSchema = new Schema<UserFollowMangaType>(
  {
    userId: { type: String, ref: "User", required: true },
    mangaId: { type: String, ref: "Manga", required: true },
  },
  { timestamps: false },
);

UserFollowMangaSchema.index({ userId: 1, mangaId: 1 }, { unique: true });

export const UserFollowMangaModel = model("UserFollowManga", UserFollowMangaSchema);
