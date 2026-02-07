import { model, Schema } from "mongoose";

export type WaifuLeaderboardSnapshotEntry = {
  id: string;
  rank: number;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  userLevel?: number;
  userFaction?: number;
  userGender?: number;
  totalWaifu: number;
  totalWaifu3Stars: number;
  totalWaifu4Stars: number;
  totalWaifu5Stars: number;
  waifuCollection: {
    waifuId: string;
    name?: string;
    image?: string;
    stars?: number;
    expBuff?: number;
    goldBuff?: number;
  }[];
  calculatedAt: Date;
};

const WaifuLeaderboardSnapshotSchema = new Schema<WaifuLeaderboardSnapshotEntry>(
  {
    rank: { type: Number, required: true },
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    userAvatar: { type: String, default: null },
    userLevel: { type: Number, default: 0 },
    userFaction: { type: Number, default: 0 },
    userGender: { type: Number, default: 0 },
    totalWaifu: { type: Number, default: 0 },
    totalWaifu3Stars: { type: Number, default: 0 },
    totalWaifu4Stars: { type: Number, default: 0 },
    totalWaifu5Stars: { type: Number, default: 0 },
    waifuCollection: {
      type: [
        {
          waifuId: { type: String },
          name: { type: String },
          image: { type: String },
          stars: { type: Number },
          expBuff: { type: Number },
          goldBuff: { type: Number },
        },
      ],
      default: [],
    },
    calculatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: "waifu_leaderboard_snapshot",
  },
);

WaifuLeaderboardSnapshotSchema.index({ rank: 1 });

export const WaifuLeaderboardSnapshotModel = model(
  "WaifuLeaderboardSnapshot",
  WaifuLeaderboardSnapshotSchema,
);
