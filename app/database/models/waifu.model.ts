import { model, Schema } from "mongoose";

export type WaifuType = {
  id: string;
  name: string;
  image: string;
  stars: number;
  expBuff: number;
  goldBuff: number;
  description?: string;
};

const WaifuSchema = new Schema<WaifuType>(
  {
    name: { type: String, required: true },
    image: { type: String, required: true },
    stars: { type: Number, required: true },
    expBuff: { type: Number, required: true },
    goldBuff: { type: Number, required: true },
    description: { type: String },
  },
  { timestamps: true },
);

export const WaifuModel = model("Waifu", WaifuSchema);
