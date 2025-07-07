import { model, Schema } from "mongoose";

export type UserWaifuType = {
  id: string;
  userId: string;
  waifuId: string;
  bannerId: string;
  waifuName: string;
  waifuStars: number;
  createdAt: Date;
  updatedAt: Date;
};

const UserWaifuSchema = new Schema<UserWaifuType>(
  {
    userId: { type: String, required: true },
    waifuId: { type: String, required: true },
    bannerId: { type: String, required: true },
    waifuName: { type: String, required: true },
    waifuStars: { type: Number, required: true },
  },
  { timestamps: true },
);

// 2. Query: { userId, bannerId } + sort { createdAt: -1 } - summon history pagination
UserWaifuSchema.index({ userId: 1, bannerId: 1, createdAt: -1 });

// 3. Query: { userId, waifuId } + sort { createdAt: -1 } - sacrifice operations
UserWaifuSchema.index({ userId: 1, waifuId: 1, createdAt: -1 });

export const UserWaifuModel = model("UserWaifu", UserWaifuSchema);
