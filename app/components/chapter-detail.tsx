import { useEffect, useRef, useState } from "react";
import { toast, Toaster } from "react-hot-toast";
import { useFetcher, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import ReportDialog from "./dialog-report";
import { Dropdown } from "./dropdown";

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
// --- display title: nếu backend/FE đặt placeholder "..." thì hiển thị "Chương {number}"
const isPlaceholderTitle = (t?: string) => (t ?? "").trim() === "...";
const displayTitle = isPlaceholderTitle(chapter.title) ? `Chương ${chapter.chapterNumber}` : chapter.title;

  const [_, setSearchParams] = useSearchParams();
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [hasClaimedThisChapter, setHasClaimedThisChapter] = useState(false);
  const [chapters, setChapters] = useState<Array<{ value: number; label: string }>>([]);

  // New states for reading completion tracking
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [hasCompletedReading, setHasCompletedReading] = useState(false);
  const [readingStartTime, setReadingStartTime] = useState<number | null>(null);

  const fetcher = useFetcher();
  const rewardFetcher = useFetcher();
  const expFetcher = useFetcher();
  const chaptersFetcher = useFetcher();
  const readingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastImageRef = useRef<HTMLImageElement | null>(null);
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch chapters list
  useEffect(() => {
    chaptersFetcher.load(`/api/chapters/list?mangaId=${chapter.mangaId}`);
  }, [chapter.mangaId]);

  // Handle chapters list response
  useEffect(() => {
    if (chaptersFetcher.data) {
      const response = chaptersFetcher.data as {
        success: boolean;
        chapters?: Array<any>;
        error?: string;
      };
      if (response.success && response.chapters) {
        // BEGIN feature: chapter dropdown UX
        // Giữ nguyên {value,label}, nhưng nếu API có tiêu đề (title/name/chapterTitle) thì nối thêm vào object
        const normalized = response.chapters.map((c: any) => ({
          value: c.value,
          label: c.label,
          // chấp nhận nhiều khóa phổ biến từ API:
          __title: c.title ?? c.name ?? c.chapterTitle ?? "",
        }));
        setChapters(normalized);
        // END feature: chapter dropdown UX
      }
    }
  }, [chaptersFetcher.data]);

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
      const remainingTime = minimumReadingTime - readingDuration;
      completionTimeoutRef.current = setTimeout(() => {
        submitReadingExp();
      }, remainingTime);
    } else {
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
      setHasClaimedThisChapter(true);
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

      if (
        response.error &&
        !response.error.includes("Vui lòng chờ") &&
        !response.error.includes("đã nhận đủ")
      ) {
        toast.error(response.error);
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

  const handleChapterSelect = (chapterNumber: number) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("chapterNumber", chapterNumber.toString());
      return newParams;
    });
  };

  // BEGIN feature: chapter dropdown UX
  // - Nút chỉ hiển thị "Chương {số}"
  const buttonLabel = `Chương ${chapter.chapterNumber}`;

  // - Mỗi option trong MENU: "Chương {số} — {tiêu đề}" nếu có tiêu đề, không thì "Chương {số}"
  const renderChapterOption = (opt: any) => {
    const base = `Chương ${opt.value}`;
    const titleFromApi =
      (opt && (opt.__title ?? opt.title ?? opt.name ?? opt.chapterTitle)) || "";
const titleTrim = String(titleFromApi).trim();
    const raw = (opt.label || "").trim();

    // Ưu tiên tiêu đề từ API nếu có và không phải placeholder "..."
    if (titleTrim && titleTrim !== "...") {
      return `${base} — ${titleTrim}`;
    }

    // Nếu đã là "Chương N — Tiêu đề" / "Chương N - Tiêu đề" → chuẩn hóa dấu "—"
    if (/^Chương\s+\d+\s*(—|-)\s*/i.test(raw)) {
      return raw.replace(/^Chương\s+(\d+)\s*(?:—|-)\s*/i, (_, n) => `Chương ${n} — `);
    }

    // Nếu chỉ có số chương hoặc rỗng → "Chương N"
    if (raw === base || /^Chương\s+\d+$/i.test(raw) || raw === "") {
      return base;
    }

    // Mặc định: xem phần còn lại là tiêu đề
    return `${base} — ${raw.replace(/^Chương\s+\d+\s*(—|-)?\s*/i, "")}`;
  };
  // END feature: chapter dropdown UX

  return (
    <>
      <Toaster position="bottom-right" />
      <div
        className="bg-bgc-layer1 border-bd-default mx-auto flex w-full max-w-[1080px] flex-col gap-4 rounded-xl border p-4 sm:p-6
        // BEGIN feature: discord visibility (stacking context for the whole card)
        isolate
        // END feature: discord visibility
        "
      >
        {/* Header Section */}
        <div className="flex flex-col gap-2">
          <div className="text-txt-focus font-sans text-base leading-normal font-medium">
            {chapter.breadcrumb}
          </div>
          <div className="text-txt-primary font-sans text-2xl leading-loose font-semibold">
            {displayTitle}
          </div>
          <div className="text-txt-secondary font-sans text-base leading-normal font-medium">
            Cập nhật lúc {formatTime(chapter.updatedAt)} {formatDate(chapter.updatedAt)}
          </div>
        </div>

        {/* Divider */}
        <div className="border-bd-default h-0 border-t"></div>

        {/* Error Report Section (Discord CTA nằm trong đây) */}
        <div
          className="bg-bgc-layer2 flex flex-col items-center gap-2 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between
          // BEGIN feature: discord visibility (raise Discord above)
          relative z-20
          // END feature: discord visibility
          "
        >
          <div className="text-txt-primary font-sans text-base leading-normal font-medium">
            Nhận thông tin mới, chém gió, thảo luận, liên hệ dịch giả, báo lỗi :
          </div>
          <a
            href="https://discord.gg/rFwBnNAJk5"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Tham gia Discord VinaHentai"
            className="flex cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#6B8CFF] to-[#D373FF] px-4 py-3 shadow-[0px_4px_8.9px_0px_rgba(196,69,255,0.25)] transition-all hover:scale-105 hover:shadow-[0px_6px_12px_0px_rgba(196,69,255,0.35)]"
          >
            <img
              src="/images/icons/discord-white.svg"
              alt=""
              className="h-5 w-5"
              aria-hidden="true"
            />
            <span className="font-sans text-sm leading-tight font-semibold">
              Tham gia Discord VinaHentai
            </span>
          </a>
        </div>

        {/* Navigation Controls (TOP) */}
        <div
          className="flex items-center justify-center gap-3
          // BEGIN feature: discord visibility (neutralize stacking so it won't cover Discord)
          relative z-0
          // END feature: discord visibility
          "
        >
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
          {/* BEGIN feature: chapter dropdown UX */}
          <Dropdown
            options={chapters}
            value={chapter.chapterNumber}
            placeholder="Chọn chương"
            onSelect={handleChapterSelect}
            className="min-w-[140px]"
            buttonLabel={buttonLabel}
            renderOptionLabel={(o) => renderChapterOption(o as any)}
            menuWidthMultiplier={2}
          />
          {/* END feature: chapter dropdown UX */}

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
      <div
        className="-mx-4 my-6 flex flex-col items-center justify-center sm:mx-0 sm:my-8
        // BEGIN feature: discord visibility (ensure content won't overlay Discord)
        relative z-0
        // END feature: discord visibility
        "
      >
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
                handleImageLoad(url);
              }}
            />
          );
        })}
      </div>

      {/* Navigation Controls (BOTTOM) */}
      <div
        className="mb-6 flex items-center justify-center gap-3 sm:mb-8
        // BEGIN feature: discord visibility (neutral layer)
        relative z-0
        // END feature: discord visibility
        "
      >
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
        {/* BEGIN feature: chapter dropdown UX */}
        <Dropdown
          options={chapters}
          value={chapter.chapterNumber}
          placeholder="Chọn chương"
          onSelect={handleChapterSelect}
          className="min-w-[140px]"
          buttonLabel={buttonLabel}
          renderOptionLabel={(o) => renderChapterOption(o as any)}
          menuWidthMultiplier={2}
        />
        {/* END feature: chapter dropdown UX */}

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
