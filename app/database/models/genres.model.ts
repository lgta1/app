import { model, Schema } from "mongoose";

import { GENRE_CATEGORY } from "~/constants/genres";

export type GenresType = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
};

const GenresSchema = new Schema<GenresType>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true, enum: GENRE_CATEGORY },
  },
  { timestamps: true },
);

// Index cho slug lookup
GenresSchema.index({ slug: 1 }, { unique: true });

export const GenresModel = model("Genres", GenresSchema);
