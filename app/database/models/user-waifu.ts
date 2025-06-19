import { model, Schema } from "mongoose";

export type UserWaifuType = {
  id: string;
  bannerId: string;
  userId: string;
  waifuId: string;
  waifuName: string;
  waifuStars: number;
  createdAt: Date;
  updatedAt: Date;
};

const UserWaifuSchema = new Schema<UserWaifuType>(
  {
    bannerId: { type: String, required: true },
    userId: { type: String, required: true },
    waifuId: { type: String, required: true },
    waifuName: { type: String, required: true },
    waifuStars: { type: Number, required: true },
  },
  { timestamps: true },
);

export const UserWaifuModel = model("UserWaifu", UserWaifuSchema);
