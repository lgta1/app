// app/database/models/translator.model.ts
import mongoose from "mongoose";

const { Schema, model } = mongoose;

export type TranslatorType = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  followNumber?: number;
  createdAt: Date;
  updatedAt: Date;
};

const TranslatorSchema = new Schema<TranslatorType>(
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
    followNumber: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const TranslatorModel =
  (mongoose.models.Translator as mongoose.Model<TranslatorType>) ||
  model<TranslatorType>("Translator", TranslatorSchema);
