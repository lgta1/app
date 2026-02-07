import { model, Schema } from "mongoose";

export type TranslatorLeaderboardEntry = {
  id: string;
  rank: number;
  totalViews: number;
  userId: Schema.Types.ObjectId;
  userName: string;
  userAvatar?: string | null;
  calculatedAt: Date;
};

const TranslatorLeaderboardSchema = new Schema<TranslatorLeaderboardEntry>(
  {
    rank: { type: Number, required: true },
    totalViews: { type: Number, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    userAvatar: { type: String, default: null },
    calculatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: "translator_leaderboard_weekly",
  },
);

TranslatorLeaderboardSchema.index({ rank: 1 });
TranslatorLeaderboardSchema.index({ totalViews: -1 });

export const TranslatorWeeklyLeaderboardModel = model(
  "TranslatorWeeklyLeaderboard",
  TranslatorLeaderboardSchema.clone(),
  "translator_leaderboard_weekly",
);

export const TranslatorMonthlyLeaderboardModel = model(
  "TranslatorMonthlyLeaderboard",
  TranslatorLeaderboardSchema.clone(),
  "translator_leaderboard_monthly",
);

export const TranslatorAlltimeLeaderboardModel = model(
  "TranslatorAlltimeLeaderboard",
  TranslatorLeaderboardSchema.clone(),
  "translator_leaderboard_alltime",
);
