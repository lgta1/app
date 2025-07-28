import { useEffect, useRef, useState } from "react";
import { toast, Toaster } from "react-hot-toast";
import { useSearchParams } from "react-router";
import { useFetcher } from "react-router";
import { ChevronDown, ChevronLeft, ChevronRight, Info } from "lucide-react";

import ReportDialog from "./dialog-report";

import RelatedManga from "~/components/related-manga";
import { REPORT_TYPE } from "~/constants/report";
import type { ChapterType } from "~/database/models/chapter.model";
import type { MangaType } from "~/database/models/manga.model";
import { formatDate, formatTime } from "~/utils/date.utils";

type ChapterDetailProps = {
  chapter: ChapterType & {
    breadcrumb: string;
    hasPrevious: boolean;
    hasNext: boolean;
  };
  isEnableClaimReward?: boolean;
  relatedManga?: MangaType[];
};

export function ChapterDetail({
  chapter,
  isEnableClaimReward: isEnableClaimGold = false,
  relatedManga = [],
}: ChapterDetailProps) {
  const [_, setSearchParams] = useSearchParams();
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [hasClaimedThisChapter, setHasClaimedThisChapter] = useState(false);

  // New states for reading completion tracking
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [hasCompletedReading, setHasCompletedReading] = useState(false);
  const [readingStartTime, setReadingStartTime] = useState<number | null>(null);

  const fetcher = useFetcher();
  const rewardFetcher = useFetcher();
  const expFetcher = useFetcher();
  const readingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastImageRef = useRef<HTMLImageElement | null>(null);
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset states khi chuyển chapter
  useEffect(() => {
    setLoadedImages(new Set());
    setHasCompletedReading(false);
    setReadingStartTime(Date.now());
    startTimeRef.current = Date.now();
    setHasClaimedThisChapter(false);

    // Clear any existing timeouts
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
    }

    const time = 60000 * (1 + Math.floor(Math.random() * 5));

    readingTimerRef.current = setTimeout(() => {
      // Tự động claim reward sau 1 phút nếu chưa claim
      if (!hasClaimedThisChapter && isEnableClaimGold) {
        const formData = new FormData();
        formData.append("intent", "claim-reading-reward");

        rewardFetcher.submit(formData, {
          method: "POST",
          action: "/api/reading-reward",
        });
      }
    }, time); // random time between 1 and 5 minutes

    return () => {
      if (readingTimerRef.current) {
        clearTimeout(readingTimerRef.current);
      }
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
      }
    };
  }, [chapter.id]); // Reset khi chuyển chapter

  // Track image loading
  const handleImageLoad = (url: string) => {
    setLoadedImages((prev) => new Set([...prev, url]));
  };

  // Check if all images are loaded
  const allImagesLoaded = loadedImages.size === chapter.contentUrls.length;

  // Setup Intersection Observer for last image
  useEffect(() => {
    if (!lastImageRef.current || !allImagesLoaded) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            // User has viewed the last image with at least 50% visibility
            handleReadingCompletion();
          }
        });
      },
      {
        threshold: 0.5, // Trigger when 50% of the last image is visible
        rootMargin: "0px 0px -10% 0px", // Add some margin from bottom
      },
    );

    observer.observe(lastImageRef.current);

    return () => {
      observer.disconnect();
    };
  }, [allImagesLoaded, hasCompletedReading]);

  const handleReadingCompletion = () => {
    if (hasCompletedReading || !readingStartTime) return;

    const now = Date.now();
    const readingDuration = now - readingStartTime;
    const minimumReadingTime = 60000; // Minimum 1 minute

    // Đảm bảo user đã đọc ít nhất 1 phút
    if (readingDuration < minimumReadingTime) {
      // Delay để đợi đủ thời gian đọc tối thiểu
      const remainingTime = minimumReadingTime - readingDuration;
      completionTimeoutRef.current = setTimeout(() => {
        submitReadingExp();
      }, remainingTime);
    } else {
      // Delay thêm 2-3 giây để đảm bảo user thực sự đọc xong
      completionTimeoutRef.current = setTimeout(
        () => {
          submitReadingExp();
        },
        2000 + Math.random() * 1000,
      );
    }
  };

  const submitReadingExp = () => {
    if (hasCompletedReading) return;

    setHasCompletedReading(true);

    const formData = new FormData();
    formData.append("intent", "claim-reading-exp");
    formData.append("chapterId", chapter.id);

    expFetcher.submit(formData, {
      method: "POST",
      action: "/api/reading-exp",
    });

    // Record view interaction (non-blocking)
    const viewFormData = new FormData();
    viewFormData.append("story_id", chapter.mangaId);
    viewFormData.append("type", "view");
    // Note: userId sẽ được lấy từ session trong API

    fetch("/api/interactions", {
      method: "POST",
      body: viewFormData,
    }).catch((error) => {
      console.error("Lỗi khi ghi view interaction:", error);
    });
  };

  // Handle API response cho report
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

  // Handle API response cho reading reward
  useEffect(() => {
    if (rewardFetcher.data) {
      const response = rewardFetcher.data as {
        success: boolean;
        message?: string;
        error?: string;
        goldAmount?: number;
        remainingClaims?: number;
      };

      if (response.success) {
        toast.success(response.message || "Nhận vàng thành công!");
        setHasClaimedThisChapter(true);
      } else {
        // Chỉ hiển thị toast error cho các lỗi không phải "không trúng"
        if (response.error && !response.error.includes("Chúc bạn may mắn lần sau")) {
          toast.error(response.error);
        }
        setHasClaimedThisChapter(true); // Đánh dấu đã thử claim rồi
      }
    }
  }, [rewardFetcher.data]);

  // Handle API response cho reading exp
  useEffect(() => {
    if (expFetcher.data) {
      const response = expFetcher.data as {
        success: boolean;
        message?: string;
        error?: string;
        expGained?: number;
        totalExp?: number;
        chaptersRead?: number;
        remainingExp?: number;
      };

      if (response.success) {
        toast.success(response.message || "Nhận exp thành công!");
      } else {
        // Chỉ hiển thị error nếu không phải lỗi rate limit hoặc đã đủ exp
        if (
          response.error &&
          !response.error.includes("Vui lòng chờ") &&
          !response.error.includes("đã nhận đủ")
        ) {
          toast.error(response.error);
        }
      }
    }
  }, [expFetcher.data]);

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
        {chapter.contentUrls.map((url, index) => {
          const isLastImage = index === chapter.contentUrls.length - 1;
          return (
            <img
              loading="lazy"
              ref={isLastImage ? lastImageRef : undefined}
              src={url}
              alt={`Chapter Content ${index + 1}`}
              key={url}
              className="w-full max-w-[1080px]"
              onLoad={() => handleImageLoad(url)}
              onError={() => {
                console.error(`Failed to load image: ${url}`);
                // Still mark as "loaded" to prevent blocking completion
                handleImageLoad(url);
              }}
            />
          );
        })}
      </div>

      {/* Navigation Controls */}
      <div className="mb-6 flex items-center justify-center gap-3 sm:mb-8">
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

      {relatedManga.length > 0 && <RelatedManga mangaList={relatedManga} />}

      {/* Report Dialog */}
      <ReportDialog
        isOpen={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
        onSubmit={handleReportSubmit}
      />
    </>
  );
}
