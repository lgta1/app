// app/database/models/character.model.ts
import mongoose from "mongoose";

const { Schema, model } = mongoose;

export type CharacterType = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

const CharacterSchema = new Schema<CharacterType>(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: true },
);

export const CharacterModel =
  (mongoose.models.Character as mongoose.Model<CharacterType>) ||
  model<CharacterType>("Character", CharacterSchema);
