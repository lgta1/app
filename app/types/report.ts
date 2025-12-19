import type { ReportType } from "~/database/models/report.model";

export interface ReportReporterInfo {
  id: string;
  name: string;
  email?: string;
}

export type ReportWithMeta = ReportType & {
  chapterTitle?: string;
  mangaTitle?: string;
  reporterUser?: ReportReporterInfo;
};
