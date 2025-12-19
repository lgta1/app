import { Clock, Gift } from "lucide-react";

import { REPORT_TYPE } from "~/constants/report";
import type { ReportType } from "~/database/models/report.model";
import { formatDate, formatTime } from "~/utils/date.utils";

type ReportCardReport = ReportType & {
  chapterTitle?: string;
  mangaTitle?: string;
  reporterUser?: {
    id: string;
    name: string;
    email?: string;
  };
};

interface ReportCardProps {
  report: ReportCardReport;
  onDeleteClick: (reportId: string) => void;
  onViewClick: (report: ReportCardReport) => void;
  onRewardClick?: (report: ReportCardReport) => void;
}

// Helper function để map report type
function getReportTypeDisplay(reportType: string, mangaId: any): string {
  switch (reportType) {
    case REPORT_TYPE.MANGA:
      return "Truyện";
    case REPORT_TYPE.COMMENT:
      if (mangaId) {
        return "Bình luận (truyện)";
      }
      return "Bình luận (diễn đàn)";
    default:
      return reportType;
  }
}

export function ReportCard({ report, onDeleteClick, onViewClick, onRewardClick }: ReportCardProps) {
  const reportTypeColor =
    report.reportType === REPORT_TYPE.MANGA ? "text-[#25EBAC]" : "text-[#FFE133]";
  const isMangaReport = report.reportType === REPORT_TYPE.MANGA;
  const targetLabel = isMangaReport ? "Chương báo cáo" : "Đối tượng báo cáo";
  const targetValue = isMangaReport
    ? report.chapterTitle || report.targetName
    : report.targetName;
  const canReward = Boolean(report.reporterUser?.id && onRewardClick);

  return (
    <div className="border-bd-default bg-bgc-layer2 relative flex flex-col gap-4 self-stretch rounded-xl border p-6">
      {/* Timestamp */}
      <div className="inline-flex items-center gap-2">
        <div className="relative h-4 w-4 overflow-hidden">
          <div className="absolute top-[0.67px] left-[0.67px] h-3.5 w-3.5">
            <Clock className="text-txt-secondary h-3.5 w-3.5" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
            {formatTime(report.createdAt)}
          </div>
          <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
            {formatDate(report.createdAt)}
          </div>
        </div>
      </div>

      {/* Main Info - Responsive Layout */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-20">
        <div className="flex flex-col gap-4 md:flex-row md:gap-8 lg:gap-20">
          <div className="inline-flex w-full flex-col gap-0.5 md:w-24">
            <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
              Người báo cáo
            </div>
            <div className="text-txt-primary font-sans text-base leading-normal font-semibold">
              {report.reporterName}
            </div>
            {report.reporterUser?.email && (
              <div className="text-txt-secondary font-sans text-xs leading-tight">
                {report.reporterUser.email}
              </div>
            )}
          </div>

          <div className="inline-flex w-full flex-col gap-0.5 md:w-24">
            <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
              Loại báo cáo
            </div>
            <div
              className={`font-sans text-base leading-normal font-semibold ${reportTypeColor}`}
            >
              {getReportTypeDisplay(report.reportType, report.mangaId)}
            </div>
          </div>
        </div>

        <div className="inline-flex flex-col gap-0.5">
          <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
            {targetLabel}
          </div>
          <div className="text-txt-primary font-sans text-base leading-normal font-semibold">
            {targetValue}
          </div>
          {isMangaReport && report.mangaTitle && (
            <div className="text-txt-secondary font-sans text-xs leading-tight">
              Truyện: <span className="text-txt-primary font-semibold">{report.mangaTitle}</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-0.5 self-stretch">
        <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
          Nội dung
        </div>
        <div className="text-txt-primary font-sans text-base leading-normal font-semibold">
          {report.reason}
        </div>
      </div>

      {/* Action Buttons - Responsive Position */}
      <div className="flex items-center gap-2 self-end lg:absolute lg:top-4 lg:right-6">
        {canReward && (
          <button
            onClick={() => onRewardClick?.(report)}
            className="flex items-center justify-center gap-2.5 rounded-xl border border-[#F97316] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(249,115,22,0.25)]"
          >
            <Gift className="h-4 w-4 text-[#F97316]" />
            <div className="cursor-pointer text-center font-sans text-sm leading-tight font-semibold text-[#F97316]">
              Thưởng
            </div>
          </button>
        )}
        <button
          onClick={() => onDeleteClick(report.id)}
          className="flex items-center justify-center gap-2.5 rounded-xl border border-[#E03F46] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(146,53,190,0.25)]"
        >
          <div className="cursor-pointer text-center font-sans text-sm leading-tight font-semibold text-[#E03F46]">
            Xóa
          </div>
        </button>

        <button
          onClick={() => onViewClick(report)}
          className="flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)]"
        >
          <div className="cursor-pointer text-center font-sans text-sm leading-tight font-semibold text-black">
            Xem
          </div>
        </button>
      </div>
    </div>
  );
}
