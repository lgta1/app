import { model, Schema } from "mongoose";

export type DailyCheckinType = {
  id: string;
  userId: string;
  weekStart: Date; // Ngày đầu tuần (thứ 2)
  checkedDays: number[]; // Mảng các ngày đã check-in (0 = thứ 2, 6 = chủ nhật)
  goldEarned: number; // Tổng gold đã nhận trong tuần này
  createdAt: Date;
  updatedAt: Date;
};

const DailyCheckinSchema = new Schema<DailyCheckinType>(
  {
    userId: { type: String, required: true, ref: "User" },
    weekStart: { type: Date, required: true },
    checkedDays: { type: [Number], default: [] },
    goldEarned: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Index để tìm kiếm nhanh theo userId và tuần
DailyCheckinSchema.index({ userId: 1, weekStart: 1 }, { unique: true });
DailyCheckinSchema.index({ userId: 1 });

export const DailyCheckinModel = model("DailyCheckin", DailyCheckinSchema);
