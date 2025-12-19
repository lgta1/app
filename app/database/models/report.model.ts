import { model, Schema } from "mongoose";

import { REPORT_TYPE } from "~/constants/report";

export type ReportType = {
  id: string;
  reporterName: string;
  targetName: string;
  reason: string;
  reportType: string;
  targetId: Schema.Types.ObjectId;
  reporterId?: Schema.Types.ObjectId;
  mangaId?: Schema.Types.ObjectId;
  postId?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const ReportSchema = new Schema<ReportType>(
  {
    reporterName: { type: String, required: true },
    targetName: { type: String, required: true },
    reason: { type: String, required: true },
    reportType: { type: String, required: true, enum: REPORT_TYPE },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reporterId: { type: Schema.Types.ObjectId, ref: "User" },
    mangaId: { type: Schema.Types.ObjectId },
    postId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);

// Index để tối ưu query sorting theo createdAt
ReportSchema.index({ createdAt: -1 });

// Index để tối ưu query filter theo reportType + sort theo createdAt
ReportSchema.index({ reportType: 1, createdAt: -1 });

export const ReportModel = model("Report", ReportSchema);
