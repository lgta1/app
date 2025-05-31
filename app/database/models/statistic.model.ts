import { model, Schema } from "mongoose";

export type StatisticType = {
  id: string;
  viewNumber: number;
  likeNumber: number;
  commentNumber: number;
  createdAt: Date;
  updatedAt: Date;
};

const StatisticSchema = new Schema<StatisticType>(
  {
    viewNumber: { type: Number, default: 0 },
    likeNumber: { type: Number, default: 0 },
    commentNumber: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const StatisticModel = model("Statistic", StatisticSchema);
