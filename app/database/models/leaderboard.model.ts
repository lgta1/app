import { model, Schema } from "mongoose";

export type LeaderboardType = {
  id: string;
  rank: number;
  score: number;
  story_id: Schema.Types.ObjectId;
  views_in_period: number;
  likes_in_period: number;
  comments_in_period: number;
  calculated_at: Date;
};

const LeaderboardSchema = new Schema<LeaderboardType>(
  {
    rank: { type: Number, required: true },
    score: { type: Number, required: true },
    story_id: { type: Schema.Types.ObjectId, ref: "Manga", required: true },
    views_in_period: { type: Number, default: 0 },
    likes_in_period: { type: Number, default: 0 },
    comments_in_period: { type: Number, default: 0 },
    calculated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: "daily_leaderboard", // Default collection, sẽ override khi tạo model cụ thể
  },
);

// Index cho performance
LeaderboardSchema.index({ rank: 1 });
LeaderboardSchema.index({ score: -1 });
LeaderboardSchema.index({ calculated_at: -1 });

// Tạo các models cho từng loại leaderboard
export const DailyLeaderboardModel = model(
  "DailyLeaderboard",
  LeaderboardSchema.clone(),
  "daily_leaderboard",
);
export const WeeklyLeaderboardModel = model(
  "WeeklyLeaderboard",
  LeaderboardSchema.clone(),
  "weekly_leaderboard",
);
export const MonthlyLeaderboardModel = model(
  "MonthlyLeaderboard",
  LeaderboardSchema.clone(),
  "monthly_leaderboard",
);
