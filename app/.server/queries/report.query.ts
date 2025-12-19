import { ReportModel, type ReportType } from "~/database/models/report.model";
import { ChapterModel } from "~/database/models/chapter.model";
import { MangaModel } from "~/database/models/manga.model";
import { UserModel } from "~/database/models/user.model";
import { REPORT_TYPE } from "~/constants/report";
import { BusinessError } from "~/helpers/errors.helper";
import type { ReportWithMeta, ReportReporterInfo } from "~/types/report";

export interface GetReportsParams {
  reportTypes?: string[];
  sortBy?: string;
  page?: number;
  limit?: number;
}

export interface GetReportsResult {
  reports: ReportWithMeta[];
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

    const enrichedReports = await enrichReportsWithRelations(reports as ReportType[]);

    const totalPages = Math.ceil(total / limit);

    return {
      reports: enrichedReports,
      total,
      page,
      totalPages,
    };
  } catch (error) {
    console.error("Error fetching reports:", error);
    throw new BusinessError("Không thể lấy dữ liệu báo cáo");
  }
}

function toIdString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof (value as any)?.toString === "function") {
    const result = (value as any).toString();
    return result && result !== "[object Object]" ? result : null;
  }
  return null;
}

function stripChapterSuffix(targetName?: string | null): string | undefined {
  if (!targetName) return undefined;
  const parts = targetName.split(/—|-/);
  if (parts.length === 0) return targetName.trim() || undefined;
  const candidate = parts[0]?.trim();
  return candidate || targetName.trim() || undefined;
}

async function enrichReportsWithRelations(reports: ReportType[]): Promise<ReportWithMeta[]> {
  if (!reports.length) return [];

  const chapterIdMap = new Map<string, any>();
  const mangaIdMap = new Map<string, any>();
  const reporterIdMap = new Map<string, any>();
  const reporterNameSet = new Set<string>();

  for (const report of reports) {
    if (report.reportType === REPORT_TYPE.MANGA && report.targetId) {
      const targetIdStr = toIdString(report.targetId);
      if (targetIdStr && !chapterIdMap.has(targetIdStr)) {
        chapterIdMap.set(targetIdStr, report.targetId);
      }
    }

    const mangaIdStr = toIdString(report.mangaId);
    if (mangaIdStr && !mangaIdMap.has(mangaIdStr)) {
      mangaIdMap.set(mangaIdStr, report.mangaId);
    }

    const reporterIdStr = toIdString(report.reporterId);
    if (reporterIdStr && !reporterIdMap.has(reporterIdStr)) {
      reporterIdMap.set(reporterIdStr, report.reporterId);
    } else if (!reporterIdStr && report.reporterName) {
      reporterNameSet.add(report.reporterName);
    }
  }

  const [chapterDocs, mangaDocs, reporterDocsById, reporterDocsByName] = await Promise.all([
    chapterIdMap.size
      ? ChapterModel.find({ _id: { $in: Array.from(chapterIdMap.values()) } })
          .select("title mangaId")
          .lean()
      : [],
    mangaIdMap.size
      ? MangaModel.find({ _id: { $in: Array.from(mangaIdMap.values()) } })
          .select("title")
          .lean()
      : [],
    reporterIdMap.size
      ? UserModel.find({ _id: { $in: Array.from(reporterIdMap.values()) } })
          .select("name email")
          .lean()
      : [],
    reporterNameSet.size
      ? UserModel.find({ name: { $in: Array.from(reporterNameSet.values()) } })
          .select("name email")
          .lean()
      : [],
  ]);

  const chapterMeta = new Map<string, { title?: string; mangaId?: string }>();
  chapterDocs.forEach((chapter: any) => {
    const key = toIdString(chapter._id);
    if (!key) return;
    chapterMeta.set(key, {
      title: chapter.title,
      mangaId: toIdString(chapter.mangaId) || undefined,
    });
  });

  const mangaMeta = new Map<string, string>();
  mangaDocs.forEach((manga: any) => {
    const key = toIdString(manga._id);
    if (!key) return;
    mangaMeta.set(key, manga.title);
  });

  const reporterMetaById = new Map<string, ReportReporterInfo>();
  reporterDocsById.forEach((user: any) => {
    const key = toIdString(user._id);
    if (!key) return;
    reporterMetaById.set(key, {
      id: key,
      name: user.name,
      email: user.email,
    });
  });

  const reporterMetaByName = new Map<string, ReportReporterInfo>();
  reporterDocsByName.forEach((user: any) => {
    const key = (user.name || "").toLowerCase();
    if (!key) return;
    const id = toIdString(user._id);
    reporterMetaByName.set(key, {
      id: id || user._id?.toString() || key,
      name: user.name,
      email: user.email,
    });
  });

  return reports.map((report) => {
    const chapterIdStr = toIdString(report.targetId);
    const chapterInfo = chapterIdStr ? chapterMeta.get(chapterIdStr) : undefined;

    const explicitMangaId = toIdString(report.mangaId);
    const derivedMangaId = chapterInfo?.mangaId;
    const mangaIdStr = explicitMangaId || derivedMangaId;
    const mangaTitle = mangaIdStr ? mangaMeta.get(mangaIdStr) : undefined;

    const reporterIdStr = toIdString(report.reporterId);
    const reporterById = reporterIdStr ? reporterMetaById.get(reporterIdStr) : undefined;
    const reporterByName = !reporterById && report.reporterName
      ? reporterMetaByName.get(report.reporterName.toLowerCase())
      : undefined;

    return {
      ...report,
      chapterTitle: chapterInfo?.title ?? stripChapterSuffix(report.targetName),
      mangaTitle,
      reporterUser: reporterById || reporterByName,
    };
  });
}
