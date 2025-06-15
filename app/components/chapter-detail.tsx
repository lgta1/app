import { useEffect, useState } from "react";
import { toast, Toaster } from "react-hot-toast";
import { useSearchParams } from "react-router";
import { useFetcher } from "react-router";
import { ChevronDown, ChevronLeft, ChevronRight, Info } from "lucide-react";

import ReportDialog from "./dialog-report";

import { REPORT_TYPE } from "~/constants/report";
import type { ChapterType } from "~/database/models/chapter.model";
import { formatDate, formatTime } from "~/utils/date.utils";

type ChapterDetailProps = {
  chapter: ChapterType & {
    breadcrumb: string;
    hasPrevious: boolean;
    hasNext: boolean;
  };
};

export function ChapterDetail({ chapter }: ChapterDetailProps) {
  const [_, setSearchParams] = useSearchParams();
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const fetcher = useFetcher();

  // Handle API response
  useEffect(() => {
    if (fetcher.data) {
      const response = fetcher.data as {
        success: boolean;
        message?: string;
        error?: string;
      };
      if (response.success) {
        toast.success(response.message || "Báo cáo đã được gửi thành công!");
      } else {
        toast.error(response.error || "Có lỗi xảy ra khi gửi báo cáo");
      }
    }
  }, [fetcher.data]);

  const handleReportSubmit = (content: string) => {
    const formData = new FormData();
    formData.append("intent", "create-report");
    formData.append("reason", content);
    formData.append("targetId", chapter.mangaId);
    formData.append("targetName", chapter.title);
    formData.append("reportType", REPORT_TYPE.MANGA);
    formData.append("mangaId", chapter.mangaId);

    fetcher.submit(formData, {
      method: "POST",
      action: "/api/reports",
    });
  };

  return (
    <>
      <Toaster position="bottom-right" />
      <div className="bg-bgc-layer1 border-bd-default mx-auto flex w-full max-w-[1080px] flex-col gap-4 rounded-xl border p-4 sm:p-6">
        {/* Header Section */}
        <div className="flex flex-col gap-2">
          <div className="text-txt-focus font-sans text-base leading-normal font-medium">
            {chapter.breadcrumb}
          </div>
          <div className="text-txt-primary font-sans text-2xl leading-loose font-semibold">
            {chapter.title}
          </div>
          <div className="text-txt-secondary font-sans text-base leading-normal font-medium">
            Cập nhật lúc {formatTime(chapter.updatedAt)} {formatDate(chapter.updatedAt)}
          </div>
        </div>

        {/* Divider */}
        <div className="border-bd-default h-0 border-t"></div>

        {/* Error Report Section */}
        <div className="flex flex-col items-start justify-start gap-4 sm:flex-row sm:items-center">
          <div className="text-txt-secondary font-sans text-base leading-normal font-medium">
            Nếu không Nếu bạn không đọc được truyện/chương lỗi, hãy ấn nút Báo Lỗi
          </div>
          <button
            className="border-lav-500 hover:bg-bgc-layer-semi-purple flex cursor-pointer items-center justify-center gap-2.5 rounded-xl border px-4 py-3 transition-colors"
            onClick={() => setIsReportDialogOpen(true)}
          >
            <span className="text-txt-focus font-sans text-sm leading-tight font-medium">
              Báo lỗi
            </span>
          </button>
        </div>

        {/* Info Section */}
        <div className="bg-bgc-layer2 flex items-center gap-2 rounded-xl p-3">
          <Info className="text-txt-primary h-4 w-4 flex-shrink-0" />
          <div className="text-txt-primary font-sans text-base leading-normal font-medium">
            Sử dụng mũi tên trái (←) hoặc phải (→) để chuyển chapter
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-center gap-3">
          {/* Previous Button */}
          <button
            className={`flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] p-3 shadow-[0px_4px_8.9px_0px_rgba(196,69,255,0.25)] transition-all ${
              chapter.hasPrevious
                ? "cursor-pointer hover:shadow-[0px_6px_12px_0px_rgba(196,69,255,0.35)]"
                : "cursor-not-allowed opacity-50"
            }`}
            disabled={!chapter.hasPrevious}
            onClick={() => {
              setSearchParams((prev) => {
                const newParams = new URLSearchParams(prev);
                newParams.set(
                  "chapterNumber",
                  ((chapter.chapterNumber || 2) - 1).toString(),
                );
                return newParams;
              });
            }}
          >
            <ChevronLeft className="text-bgc-layer1 h-5 w-5" />
          </button>

          {/* Chapter Selector */}
          <div className="bg-bgc-layer2 border-bd-default flex h-11 items-center gap-2.5 rounded-xl border px-3 py-2.5">
            <span className="text-txt-primary font-sans text-base leading-normal font-medium">
              Chương {chapter.chapterNumber}
            </span>
            <ChevronDown className="text-txt-secondary h-4 w-4 rotate-0" />
          </div>

          {/* Next Button */}
          <button
            className={`flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] p-3 shadow-[0px_4px_8.9px_0px_rgba(196,69,255,0.25)] transition-all ${
              chapter.hasNext
                ? "cursor-pointer hover:shadow-[0px_6px_12px_0px_rgba(196,69,255,0.35)]"
                : "cursor-not-allowed opacity-50"
            }`}
            disabled={!chapter.hasNext}
            onClick={() => {
              setSearchParams((prev) => {
                const newParams = new URLSearchParams(prev);
                newParams.set(
                  "chapterNumber",
                  ((chapter.chapterNumber || 1) + 1).toString(),
                );
                return newParams;
              });
            }}
          >
            <ChevronRight className="text-bgc-layer1 h-5 w-5" />
          </button>
        </div>
      </div>
      {/* Content Section */}
      <div className="my-6 flex flex-col items-center justify-center sm:my-8">
        {chapter.contentUrls.map((url) => (
          <img
            src={url}
            alt="Chapter Content"
            key={url}
            className="w-full max-w-[1080px]"
          />
        ))}
      </div>

      {/* Report Dialog */}
      <ReportDialog
        isOpen={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
        onSubmit={handleReportSubmit}
      />
    </>
  );
}
