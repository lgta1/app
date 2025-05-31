import { model, Schema } from "mongoose";

export type StatisticType = {
  id: string;
  totalViews: number;
  totalMembers: number;
  totalManga: number;
  totalComments: number;
  totalLikes: number;
  createdAt: Date;
  updatedAt: Date;
};

const StatisticSchema = new Schema<StatisticType>(
  {
    totalViews: { type: Number, default: 0 },
    totalMembers: { type: Number, default: 0 },
    totalManga: { type: Number, default: 0 },
    totalComments: { type: Number, default: 0 },
    totalLikes: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const StatisticModel = model("Statistic", StatisticSchema);
