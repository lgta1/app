import { model, Schema } from "mongoose";

export type SystemLockType = {
  id: string;
  key: string;
  lockedUntil: Date;
  lockedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

const SystemLockSchema = new Schema<SystemLockType>(
  {
    key: { type: String, required: true, unique: true, index: true },
    lockedUntil: { type: Date, required: true },
    lockedBy: { type: String, required: true },
  },
  { timestamps: true },
);

export const SystemLockModel = model("SystemLock", SystemLockSchema);
