import { model, Schema } from "mongoose";

import { GENDERS, ROLES } from "~/constants/user";

export type UserType = {
  id: string;
  name: string;
  email: string;
  password: string;
  salt: string;
  faction: number;
  gender: number;
  avatar: string;
  role: string;
  level: number;
  exp: number;
  gold: number;
  isBanned: boolean;
  banExpiresAt?: Date;
  banMessage?: string;
  isDeleted: boolean;
  summonCount: number;
  createdAt: Date;
  updatedAt: Date;
  mangasCount: number;
  warningsCount: number;
  bio: string;
  currentWaifu: string;
};

const UserSchema = new Schema<UserType>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    salt: { type: String, required: true },
    faction: { type: Number, enum: [0, 1] },
    gender: { type: Number, enum: GENDERS, default: GENDERS.OTHER },
    avatar: { type: String },
    role: { type: String, enum: ROLES, default: ROLES.USER },
    level: { type: Number, default: 1 },
    exp: { type: Number, default: 0 },
    gold: { type: Number, default: 0 },
    isBanned: { type: Boolean, default: false },
    banExpiresAt: { type: Date },
    banMessage: { type: String },
    isDeleted: { type: Boolean, default: false },
    mangasCount: { type: Number, default: 0 },
    warningsCount: { type: Number, default: 0 },
    summonCount: { type: Number, default: 0 },
    bio: { type: String, default: "" },
    currentWaifu: { type: String, ref: "Waifu", default: null },
  },
  { timestamps: true },
);

UserSchema.index({ email: 1 }, { unique: true });

// Index cho leaderboard - query: { role, isDeleted, isBanned } + sort { exp: -1 }
UserSchema.index({ role: 1, isDeleted: 1, isBanned: 1, exp: -1 });

// Index cho user search - query: { role, isDeleted } + regex search name/email
UserSchema.index({ role: 1, isDeleted: 1, name: 1 });
UserSchema.index({ role: 1, isDeleted: 1, email: 1 });

export const UserModel = model("User", UserSchema);
