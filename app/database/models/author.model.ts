// app/database/models/author.model.ts
import mongoose from "mongoose";

const { Schema, model } = mongoose;

export type AuthorType = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  followNumber?: number;
  createdAt: Date;
  updatedAt: Date;
};

const AuthorSchema = new Schema<AuthorType>(
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

// Tránh recompile model khi hot-reload
export const AuthorModel =
  (mongoose.models.Author as mongoose.Model<AuthorType>) ||
  model<AuthorType>("Author", AuthorSchema);
