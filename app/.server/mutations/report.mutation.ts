import { ReportModel, type ReportType } from "~/database/models/report.model";
import { BusinessError } from "~/helpers/errors.helper";

export interface CreateReportParams {
  reporterName: string;
  targetName: string;
  reason: string;
  reportType: string;
  targetId: string;
  mangaId?: string;
}

export async function createReport(params: CreateReportParams): Promise<ReportType> {
  try {
    const newReport = new ReportModel({
      reporterName: params.reporterName,
      targetName: params.targetName,
      reason: params.reason,
      reportType: params.reportType,
      targetId: params.targetId,
      mangaId: params.mangaId,
    });

    const savedReport = await newReport.save();
    return savedReport.toJSON();
  } catch (error) {
    console.error("Error creating report:", error);
    throw new BusinessError("Không thể tạo báo cáo");
  }
}

export async function deleteReport(reportId: string): Promise<boolean> {
  try {
    const result = await ReportModel.findByIdAndDelete(reportId);
    return !!result;
  } catch (error) {
    console.error("Error deleting report:", error);
    throw new BusinessError("Không thể xóa báo cáo");
  }
}

export async function getReportByTargetId(
  targetId: string,
  reportType: string,
): Promise<ReportType | null> {
  try {
    const report = await ReportModel.findOne({ targetId, reportType }).lean();
    return report;
  } catch (error) {
    console.error("Error getting report:", error);
    return null;
  }
}
