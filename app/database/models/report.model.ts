import { model, Schema } from "mongoose";

import { REPORT_TYPE } from "~/constants/report";

export type ReportType = {
  id: string;
  reporterName: string;
  targetName: string;
  reason: string;
  reportType: string;
  targetId: Schema.Types.ObjectId;
  mangaId?: Schema.Types.ObjectId;
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
    mangaId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);

export const ReportModel = model("Report", ReportSchema);
