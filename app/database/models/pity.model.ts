import { model, Schema } from "mongoose";

export type PityType = {
  id: string;
  level: number;
  label: string;
  star1: number;
  star2: number;
  star3: number;
  star4: number;
  star5: number;
  total: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const PitySchema = new Schema<PityType>(
  {
    level: { type: Number, required: true, unique: true },
    label: { type: String, required: true },
    star1: { type: Number, required: true },
    star2: { type: Number, required: true },
    star3: { type: Number, required: true },
    star4: { type: Number, required: true },
    star5: { type: Number, required: true },
    total: { type: Number, required: true, default: 100 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  },
);

export const PityModel = model("Pity", PitySchema);
