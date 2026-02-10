import { model, Schema } from "mongoose";

export type TranslatorWeeklyRewardType = {
  userId: Schema.Types.ObjectId;
  weekKey: string; // YYYY-MM-DD (Monday start, Asia/Ho_Chi_Minh)
  totalViews: number;
  gold: number;
  rewardedAt: Date;
};

const TranslatorWeeklyRewardSchema = new Schema<TranslatorWeeklyRewardType>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    weekKey: { type: String, required: true },
    totalViews: { type: Number, required: true },
    gold: { type: Number, required: true },
    rewardedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: "translator_weekly_rewards",
  },
);

TranslatorWeeklyRewardSchema.index({ userId: 1, weekKey: 1 }, { unique: true });
TranslatorWeeklyRewardSchema.index({ weekKey: 1, gold: -1 });

export const TranslatorWeeklyRewardModel = model(
  "TranslatorWeeklyReward",
  TranslatorWeeklyRewardSchema,
  "translator_weekly_rewards",
);
