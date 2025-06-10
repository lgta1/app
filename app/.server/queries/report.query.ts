import { ReportModel, type ReportType } from "~/database/models/report.model";

export interface GetReportsParams {
  reportTypes?: string[];
  sortBy?: string;
  page?: number;
  limit?: number;
}

export interface GetReportsResult {
  reports: ReportType[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getReports({
  reportTypes = [],
  sortBy = "newest",
  page = 1,
  limit = 20,
}: GetReportsParams = {}): Promise<GetReportsResult> {
  try {
    // Tạo filter query
    const filter: any = {};

    if (reportTypes.length > 0) {
      filter.reportType = { $in: reportTypes };
    }

    // Tạo sort query
    let sort: any = {};
    switch (sortBy) {
      case "newest":
        sort = { createdAt: -1 };
        break;
      case "oldest":
        sort = { createdAt: 1 };
        break;
      default:
        sort = { createdAt: -1 };
    }

    // Tính toán pagination
    const skip = (page - 1) * limit;

    // Thực hiện query với lean() để có id thay vì _id
    const [reports, total] = await Promise.all([
      ReportModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      ReportModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      reports: reports as ReportType[],
      total,
      page,
      totalPages,
    };
  } catch (error) {
    console.error("Error fetching reports:", error);
    throw new Error("Không thể lấy dữ liệu báo cáo");
  }
}
