// app/database/models/doujinshi.model.ts
import mongoose from "mongoose";

const { Schema, model } = mongoose;

export type DoujinshiType = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

const DoujinshiSchema = new Schema<DoujinshiType>(
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

export const DoujinshiModel =
  (mongoose.models.Doujinshi as mongoose.Model<DoujinshiType>) ||
  model<DoujinshiType>("Doujinshi", DoujinshiSchema);
