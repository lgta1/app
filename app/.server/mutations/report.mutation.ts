import { ReportModel, type ReportType } from "~/database/models/report.model";
import { BusinessError } from "~/helpers/errors.helper";

export interface CreateReportParams {
  reporterName: string;
  targetName: string;
  reason: string;
  reportType: string;
  targetId: string;
  mangaId?: string;
  postId?: string;
}

export async function createReport(params: CreateReportParams): Promise<ReportType> {
  try {
    const reportData: any = {
      reporterName: params.reporterName,
      targetName: params.targetName,
      reason: params.reason,
      reportType: params.reportType,
      targetId: params.targetId,
    };

    if (params.mangaId) {
      reportData.mangaId = params.mangaId;
    }

    if (params.postId) {
      reportData.postId = params.postId;
    }

    const newReport = new ReportModel(reportData);

    const savedReport = await newReport.save();
    return savedReport.toJSON();
  } catch (error) {
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
