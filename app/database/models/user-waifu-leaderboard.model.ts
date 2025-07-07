import { model, Schema } from "mongoose";

export type UserWaifuLeaderboardType = {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userLevel: number;
  userFaction: number;
  userGender: number;
  totalWaifu: number;
  totalWaifu3Stars: number;
  totalWaifu4Stars: number;
  totalWaifu5Stars: number;
  waifuCollection: {
    waifuId: string;
    name: string;
    image: string;
    stars: number;
    expBuff: number;
    goldBuff: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

const UserWaifuLeaderboardSchema = new Schema<UserWaifuLeaderboardType>(
  {
    userId: { type: String, required: true, ref: "User" },
    userName: { type: String, required: true },
    userAvatar: { type: String, required: true },
    userLevel: { type: Number, required: true },
    userFaction: { type: Number, required: true },
    userGender: { type: Number, required: true },
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
  },
  { timestamps: true },
);

// Index cho findOneAndUpdate({ userId }) và findOne({ userId })
UserWaifuLeaderboardSchema.index({ userId: 1 });

// Index cho leaderboard sorting
UserWaifuLeaderboardSchema.index({
  totalWaifu5Stars: -1,
  totalWaifu4Stars: -1,
  totalWaifu3Stars: -1,
  totalWaifu: -1,
});

export const UserWaifuLeaderboardModel = model(
  "UserWaifuLeaderboard",
  UserWaifuLeaderboardSchema,
);
