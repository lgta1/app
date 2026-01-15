import { model, Schema } from "mongoose";

export type UserWaifuInventoryType = {
  id: string;
  userId: string;
  waifuId: string;
  count: number;
  createdAt: Date;
  updatedAt: Date;
};

const UserWaifuInventorySchema = new Schema<UserWaifuInventoryType>(
  {
    userId: { type: String, required: true },
    waifuId: { type: String, required: true },
    count: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Unique ownership row per (userId, waifuId)
UserWaifuInventorySchema.index({ userId: 1, waifuId: 1 }, { unique: true });

// Common query: list inventory by userId
UserWaifuInventorySchema.index({ userId: 1, updatedAt: -1 });

export const UserWaifuInventoryModel = model(
  "UserWaifuInventory",
  UserWaifuInventorySchema,
);
