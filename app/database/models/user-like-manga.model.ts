import { model, Schema } from "mongoose";

export type UserLikeMangaType = {
  id: string;
  userId: string;
  mangaId: string;
  createdAt: Date;
};

const UserLikeMangaSchema = new Schema<UserLikeMangaType>(
  {
    userId: { type: String, ref: "User", required: true },
    mangaId: { type: String, ref: "Manga", required: true },
  },
  { timestamps: true },
);

UserLikeMangaSchema.index({ userId: 1, mangaId: 1 }, { unique: true });
UserLikeMangaSchema.index({ mangaId: 1 });
UserLikeMangaSchema.index({ userId: 1 });

export const UserLikeMangaModel = model("UserLikeManga", UserLikeMangaSchema);
