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
  likedManga: string[];
  summonCount: number;
  createdAt: Date;
  updatedAt: Date;
  storiesCount: number;
  warningsCount: number;
  bio: string;
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
    likedManga: { type: [String], default: [] },
    storiesCount: { type: Number, default: 0 },
    warningsCount: { type: Number, default: 0 },
    summonCount: { type: Number, default: 0 },
    bio: { type: String, default: "" },
  },
  { timestamps: true },
);

export const UserModel = model("User", UserSchema);
