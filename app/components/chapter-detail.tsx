// app/components/chapter-detail.tsx
import CommentDetail from "~/components/comment-detail";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast, Toaster } from "react-hot-toast";
import { useFetcher, useNavigate, Link, useRouteLoaderData } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ThumbsDown,
  ThumbsUp,
  ArrowUpToLine,
  ArrowDownToLine,
  AlertTriangle,
  Settings,
  X,
} from "lucide-react";

import ReportDialog from "./dialog-report";
import { Dropdown } from "./dropdown";
import RecommendedManga from "~/components/recommended-manga";
import LazyRender from "~/components/lazy-render";
import { REPORT_TYPE } from "~/constants/report";
import type { ChapterType } from "~/database/models/chapter.model";
import type { MangaType } from "~/database/models/manga.model";
import { formatDate, formatTime } from "../utils/date.utils";
import { getChapterDisplayName } from "../utils/chapter.utils";
import LazyImage from "~/components/lazy-image";
import { calcChapterScore, CHAPTER_RATING_CONFIG } from "~/constants/chapter-rating";

const normalizeObjectId = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "object") {
    const obj = value as Record<string, any>;
    if (typeof obj.$oid === "string") return obj.$oid;
    if (typeof obj.oid === "string") return obj.oid;
    if (typeof obj.id === "string") return obj.id;
    if (typeof obj.toHexString === "function") {
      const hex = obj.toHexString();
      if (hex && hex !== "[object Object]") return hex;
    }
    if (typeof obj.toString === "function") {
      const str = obj.toString();
      if (str && str !== "[object Object]") return str;
    }
  }
  return "";
};

type ReaderMode = "vertical" | "horizontal";
type HorizontalDirection = "ltr" | "rtl";
type DesktopPageSpread = 1 | 2;

type ReaderSettings = {
  mode: ReaderMode;
  direction: HorizontalDirection;
  desktopSpread: DesktopPageSpread;
};

const READER_SETTINGS_STORAGE_KEY = "vh_reader_settings_v1";

const CHAPTER_VIEW_POST_COOLDOWN_MS = 30 * 60 * 1000;

const READING_EVENTS_QUEUE_KEY = "vh:reading-events:queue:v1";
const READING_EVENTS_LAST_FLUSH_KEY = "vh:reading-events:last-flush-at:v1";
const READING_EVENTS_FLUSH_INTERVAL_MS = 5 * 60 * 1000;
const READING_EVENTS_MIN_FLUSH_GAP_MS = 45 * 1000;
const READING_EVENTS_QUEUE_MAX = 200;

const getSessionTimestamp = (key: string): number => {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return 0;
    const ts = Number.parseInt(raw, 10);
    return Number.isFinite(ts) ? ts : 0;
  } catch {
    return 0;
  }
};

const markSessionTimestamp = (key: string, ts = Date.now()) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, String(ts));
  } catch {
    // ignore
  }
};

const isRecentlyMarkedInSession = (key: string, cooldownMs: number) => {
  const ts = getSessionTimestamp(key);
  if (!ts) return false;
  return Date.now() - ts < cooldownMs;
};

type QueuedReadingEvent = {
  mangaId: string;
  chapterId?: string;
  chapterNumber?: number;
  ts: number;
};

type ChapterListItem = {
  value: number;
  label: string;
  slug?: string;
  __title?: string;
};

const readReadingEventsQueue = (): QueuedReadingEvent[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(READING_EVENTS_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        mangaId: String(item?.mangaId || "").trim(),
        chapterId: String(item?.chapterId || "").trim() || undefined,
        chapterNumber: Number.isFinite(Number(item?.chapterNumber)) ? Number(item.chapterNumber) : undefined,
        ts: Number.isFinite(Number(item?.ts)) ? Number(item.ts) : Date.now(),
      }))
      .filter((item) => Boolean(item.mangaId));
  } catch {
    return [];
  }
};

const writeReadingEventsQueue = (queue: QueuedReadingEvent[]) => {
  if (typeof window === "undefined") return;
  try {
    const normalized = queue.slice(-READING_EVENTS_QUEUE_MAX);
    window.sessionStorage.setItem(READING_EVENTS_QUEUE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore
  }
};

const enqueueReadingEvent = (event: QueuedReadingEvent) => {
  const queue = readReadingEventsQueue();
  const dedupeKey = `${event.mangaId}:${event.chapterId || ""}:${event.chapterNumber || ""}`;
  const exists = queue.some(
    (item) => `${item.mangaId}:${item.chapterId || ""}:${item.chapterNumber || ""}` === dedupeKey,
  );
  if (exists) return;
  queue.push(event);
  writeReadingEventsQueue(queue);
};

const shouldFlushReadingEvents = () => {
  const lastAt = getSessionTimestamp(READING_EVENTS_LAST_FLUSH_KEY);
  if (!lastAt) return true;
  return Date.now() - lastAt >= READING_EVENTS_MIN_FLUSH_GAP_MS;
};

const markReadingEventsFlushedNow = () => {
  markSessionTimestamp(READING_EVENTS_LAST_FLUSH_KEY);
};


type ChapterDetailProps = {
  chapter: ChapterType & {
    breadcrumb?: string;
    breadcrumbItems?: Array<{ label: string; href?: string }>;
    hasPrevious: boolean;
    hasNext: boolean;
    previousChapterNumber?: number;
    nextChapterNumber?: number;
    previousChapterSlug?: string;
    nextChapterSlug?: string;
    mangaSlug?: string;
  };
  chapterList?: Array<{
    value: number;
    label: string;
    slug?: string;
    title?: string;
  }>;
  isEnableClaimReward?: boolean;
  recommendedManga?: MangaType[];
};

export function ChapterDetail({
  chapter,
  chapterList = [],
  isEnableClaimReward: isEnableClaimGold = false,
  recommendedManga = [],
}: ChapterDetailProps) {
  const rootData = useRouteLoaderData("root") as { user?: { id?: string } } | undefined;
  const rootUserId = String((rootData as any)?.user?.id ?? "").trim();

  const truncateBreadcrumbLabel = (label: string, max = 20) => {
    const s = String(label ?? "");
    if (s.length <= max) return s;
    return s.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
  };

  // Lấy id chapter an toàn: ưu tiên _id rồi tới id
  const chapterIdResolved = normalizeObjectId((chapter as any)?._id ?? (chapter as any)?.id);
  const mangaIdResolved = normalizeObjectId(
    (chapter as any)?.mangaId ?? (chapter as any)?.manga?._id ?? (chapter as any)?.manga?.id,
  );
  const mangaOwnerIdResolved = normalizeObjectId(
    (chapter as any)?.manga?.ownerId ?? (chapter as any)?.mangaOwnerId ?? (chapter as any)?.ownerId,
  );
  const chapterSlugResolved = String((chapter as any)?.slug ?? "").trim();
  const chapterIdentity = useMemo(() => {
    if (chapterIdResolved) return `id:${chapterIdResolved}`;
    const n = Number((chapter as any)?.chapterNumber);
    const nKey = Number.isFinite(n) ? String(n) : "";
    const slugKey = chapterSlugResolved || "";
    const mangaKey = mangaIdResolved || String((chapter as any)?.mangaSlug ?? "").trim() || "";
    return `k:${mangaKey}:${slugKey}:${nKey}`;
  }, [chapterIdResolved, mangaIdResolved, chapterSlugResolved, chapter.chapterNumber, chapter.mangaSlug]);
  const mangaDetailUrl = chapter.mangaSlug
    ? `/truyen-hentai/${chapter.mangaSlug}`
    : mangaIdResolved
      ? `/truyen-hentai/${mangaIdResolved}`
      : "#";
  const displayTitle = getChapterDisplayName(chapter.title, chapter.chapterNumber);
  const normalizedBreadcrumbItems = useMemo(() => {
    if (Array.isArray(chapter.breadcrumbItems) && chapter.breadcrumbItems.length > 0) {
      return chapter.breadcrumbItems;
    }

    const segments = (chapter.breadcrumb || "")
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length > 0) {
      return segments.map((label, index) => {
        if (index === 0) {
          return { label, href: "/" };
        }
        if (index === 1 && mangaDetailUrl !== "#") {
          return { label, href: mangaDetailUrl };
        }
        return { label };
      });
    }

    const fallback: Array<{ label: string; href?: string }> = [{ label: "Trang chủ", href: "/" }];
    if (mangaDetailUrl !== "#") {
      fallback.push({ label: "Manga", href: mangaDetailUrl });
    }
    fallback.push({ label: displayTitle });
    return fallback;
  }, [chapter.breadcrumb, chapter.breadcrumbItems, displayTitle, mangaDetailUrl]);

  const navigate = useNavigate();
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [hasClaimedThisChapter, setHasClaimedThisChapter] = useState(false);
  const chapters = useMemo<ChapterListItem[]>(() => {
    if (!Array.isArray(chapterList)) return [];
    return chapterList
      .map((item) => ({
        value: Number(item?.value),
        label: String(item?.label ?? "").trim(),
        slug: typeof item?.slug === "string" ? item.slug : undefined,
        __title: typeof item?.title === "string" ? item.title : undefined,
      }))
      .filter((item) => Number.isFinite(item.value) && item.value > 0 && Boolean(item.label));
  }, [chapterList]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [rewardEligibility, setRewardEligibility] = useState<{
    canClaim: boolean;
    remaining: number;
    nextEligibleAt?: string;
  } | null>(null);

  // === Sticky bottom auto hide/show ===
  const [hideBottomBar, setHideBottomBar] = useState(false);
  const [isInBottomScrollZone, setIsInBottomScrollZone] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  const lastYRef = useRef(0);
  const tickingRef = useRef(false);
  const bottomZoneRef = useRef(false);

  // Anchor for scrollToBottom target
  const relatedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const THRESHOLD = 1;
    const SENSITIVITY = 1;
    const update = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        const dy = y - lastYRef.current;

        if (dy > SENSITIVITY && y > THRESHOLD) {
          setHideBottomBar(true);
        } else if (dy < -SENSITIVITY) {
          setHideBottomBar(false);
        }

        lastYRef.current = y;

        const doc = document.documentElement;
        const maxScroll = Math.max(0, (doc?.scrollHeight || 0) - window.innerHeight);
        const progress = maxScroll > 0 ? Math.min(1, Math.max(0, y / maxScroll)) : 0;
        const nextBottomZone = progress >= 0.8;
        if (nextBottomZone !== bottomZoneRef.current) {
          bottomZoneRef.current = nextBottomZone;
          setIsInBottomScrollZone(nextBottomZone);
        }

        tickingRef.current = false;
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // no static bar observer — single sticky bar only

  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [hasCompletedReading, setHasCompletedReading] = useState(false);
  const [readingStartTime, setReadingStartTime] = useState<number | null>(null);
  const [viewportIndex, setViewportIndex] = useState(0);
  const [readerMode, setReaderMode] = useState<ReaderMode>("vertical");
  const [horizontalDirection, setHorizontalDirection] = useState<HorizontalDirection>("ltr");
  const [desktopPageSpread, setDesktopPageSpread] = useState<DesktopPageSpread>(1);
  const [isReaderSettingsOpen, setIsReaderSettingsOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [horizontalPageIndex, setHorizontalPageIndex] = useState(0);

  const rewardFetcher = useFetcher();
  const expFetcher = useFetcher();
  const [isSubmittingReaction, setIsSubmittingReaction] = useState(false);
  const [chapterLikeCount, setChapterLikeCount] = useState<number>(
    Math.max(0, Number((chapter as any)?.likeNumber) || 0),
  );
  const [chapterDislikeCount, setChapterDislikeCount] = useState<number>(
    Math.max(0, Number((chapter as any)?.dislikeNumber) || 0),
  );
  const [chapterScore, setChapterScore] = useState<number>(Number((chapter as any)?.chapScore) || 0);
  const [userReaction, setUserReaction] = useState<"like" | "dislike" | null>(null);
  const readingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastImageRef = useRef<HTMLImageElement | null>(null);
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const horizontalReaderRef = useRef<HTMLDivElement | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const chapterImageCacheRef = useRef<Map<string, Set<number>>>(new Map());

  useEffect(() => {
    const applyViewport = () => {
      setIsMobileViewport(window.matchMedia("(max-width: 767px)").matches);
    };
    applyViewport();
    window.addEventListener("resize", applyViewport);
    return () => window.removeEventListener("resize", applyViewport);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(READER_SETTINGS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ReaderSettings>;
      const mode = parsed.mode === "horizontal" ? "horizontal" : "vertical";
      const direction = parsed.direction === "rtl" ? "rtl" : "ltr";
      const desktopSpread = parsed.desktopSpread === 2 ? 2 : 1;
      setReaderMode(mode);
      setHorizontalDirection(direction);
      setDesktopPageSpread(desktopSpread);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const payload: ReaderSettings = {
        mode: readerMode,
        direction: horizontalDirection,
        desktopSpread: desktopPageSpread,
      };
      localStorage.setItem(READER_SETTINGS_STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }, [readerMode, horizontalDirection, desktopPageSpread]);

  const totalPages = chapter.contentUrls.length;
  const effectivePageSpread: DesktopPageSpread = !isMobileViewport && readerMode === "horizontal" && desktopPageSpread === 2 ? 2 : 1;

  const clampPageIndex = useCallback((value: number) => {
    if (!Number.isFinite(value) || totalPages <= 0) return 0;
    return Math.min(Math.max(0, Math.round(value)), Math.max(0, totalPages - 1));
  }, [totalPages]);

  useEffect(() => {
    setHorizontalPageIndex(0);
  }, [chapterIdentity]);

  useEffect(() => {
    setHorizontalPageIndex((prev) => {
      const safe = clampPageIndex(prev);
      if (effectivePageSpread === 1) return safe;
      return Math.max(0, safe - (safe % 2));
    });
  }, [effectivePageSpread, clampPageIndex]);

  const goNextHorizontalPage = useCallback(() => {
    const step = effectivePageSpread;
    setHorizontalPageIndex((prev) => clampPageIndex(prev + step));
  }, [effectivePageSpread, clampPageIndex]);

  const goPrevHorizontalPage = useCallback(() => {
    const step = effectivePageSpread;
    setHorizontalPageIndex((prev) => clampPageIndex(prev - step));
  }, [effectivePageSpread, clampPageIndex]);

  const handleLeftAction = useCallback(() => {
    if (horizontalDirection === "rtl") goNextHorizontalPage();
    else goPrevHorizontalPage();
  }, [horizontalDirection, goNextHorizontalPage, goPrevHorizontalPage]);

  const handleRightAction = useCallback(() => {
    if (horizontalDirection === "rtl") goPrevHorizontalPage();
    else goNextHorizontalPage();
  }, [horizontalDirection, goNextHorizontalPage, goPrevHorizontalPage]);

  const handleHorizontalPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch" && e.pointerType !== "pen") {
      pointerStartRef.current = null;
      return;
    }
    pointerStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
  }, []);

  const handleHorizontalPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const elapsed = Date.now() - start.time;

    if (absDx > 40 && absDx > absDy) {
      if (dx < 0) handleRightAction();
      else handleLeftAction();
      return;
    }

    if (absDx <= 12 && absDy <= 12 && elapsed <= 320) {
      const target = e.currentTarget;
      const rect = target.getBoundingClientRect();
      const ratioX = (e.clientX - rect.left) / Math.max(1, rect.width);
      if (ratioX >= 0.33 && ratioX <= 0.67) {
        return;
      }

      if (ratioX < 0.33) handleLeftAction();
      else handleRightAction();
    }
  }, [handleLeftAction, handleRightAction]);

  useEffect(() => {
    if (readerMode !== "horizontal") return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (horizontalDirection === "rtl") goNextHorizontalPage();
        else goPrevHorizontalPage();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (horizontalDirection === "rtl") goPrevHorizontalPage();
        else goNextHorizontalPage();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [readerMode, horizontalDirection, goNextHorizontalPage, goPrevHorizontalPage]);

  const horizontalDisplayedUrls = useMemo(() => {
    if (readerMode !== "horizontal") return [] as string[];
    const first = chapter.contentUrls[horizontalPageIndex];
    if (effectivePageSpread === 1) return first ? [first] : [];
    const second = chapter.contentUrls[horizontalPageIndex + 1];
    if (horizontalDirection === "rtl") {
      return [second, first].filter((url): url is string => Boolean(url));
    }
    return [first, second].filter((url): url is string => Boolean(url));
  }, [readerMode, chapter.contentUrls, horizontalPageIndex, effectivePageSpread, horizontalDirection]);

  useEffect(() => {
    if (readerMode !== "horizontal") return;
    const chapterKey = chapterIdentity;
    const cacheForChapter = chapterImageCacheRef.current.get(chapterKey) ?? new Set<number>();
    chapterImageCacheRef.current.set(chapterKey, cacheForChapter);

    const targets = [
      horizontalPageIndex,
      horizontalPageIndex + 1,
      horizontalPageIndex + 2,
      horizontalPageIndex + 3,
      horizontalPageIndex + 4,
      horizontalPageIndex - 1,
    ].filter((idx) => idx >= 0 && idx < totalPages);

    targets.forEach((idx) => {
      if (cacheForChapter.has(idx)) return;
      const url = chapter.contentUrls[idx];
      if (!url) return;
      const img = new Image();
      img.decoding = "async";
      img.loading = "eager";
      img.src = url;
      cacheForChapter.add(idx);
    });
  }, [readerMode, chapterIdentity, chapter.contentUrls, horizontalPageIndex, totalPages]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      if (!chapterIdResolved || !rootUserId) {
        setIsLoggedIn(false);
        setRewardEligibility(null);
        setUserReaction(null);
        return;
      }

      try {
        const response = await fetch(
          `/api/chapter/user-state?chapterId=${encodeURIComponent(chapterIdResolved)}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const data = await response.json().catch(() => null);
        if (cancelled) return;

        if (!response.ok || !data?.success) {
          setIsLoggedIn(false);
          setRewardEligibility(null);
          setUserReaction(null);
          return;
        }

        setIsLoggedIn(Boolean(data.isLoggedIn));
        setRewardEligibility(data.rewardEligibility ?? null);
        setUserReaction((data.userReaction as "like" | "dislike" | null) ?? null);
      } catch (error: any) {
        if (cancelled || error?.name === "AbortError") return;
        setIsLoggedIn(false);
        setRewardEligibility(null);
        setUserReaction(null);
      }
    };

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [chapterIdentity, chapterIdResolved, rootUserId]);

  // Sync reaction state only when switching to a different chapter.
  // Avoids overwriting optimistic/confirmed reaction with stale loader data during re-renders.
  useEffect(() => {
    setChapterLikeCount(Math.max(0, Number((chapter as any)?.likeNumber) || 0));
    setChapterDislikeCount(Math.max(0, Number((chapter as any)?.dislikeNumber) || 0));
    setChapterScore(Number((chapter as any)?.chapScore) || 0);
  }, [chapterIdentity]);

  const submitReaction = useCallback(
    async (reaction: "like" | "dislike") => {
      if (!isLoggedIn) {
        toast.error("Vui lòng đăng nhập để đánh giá chương");
        return;
      }
      const mangaSlugResolved = String((chapter as any)?.mangaSlug ?? (chapter as any)?.manga?.slug ?? "").trim();
      const chapterNumberResolved = Number((chapter as any)?.chapterNumber);
      // Production: the reaction API is reliably resolvable by `chapterId` or (`mangaId` + `chapterSlug`/`chapterNumber`).
      // We intentionally avoid slug-only and mangaSlug-only resolution paths.
      const hasWorkingSlugLookup = Boolean(mangaIdResolved && chapterSlugResolved);
      const hasWorkingNumberLookup = Boolean(mangaIdResolved && Number.isFinite(chapterNumberResolved));
      if (!chapterIdResolved && !hasWorkingSlugLookup && !hasWorkingNumberLookup) {
        toast.error("Thiếu thông tin chương, vui lòng tải lại trang");
        return;
      }
      if (isSubmittingReaction) return;

      // If user clicks the same reaction again: keep it a no-op (server is also a no-op).
      if (userReaction === reaction) return;

      const prev = {
        like: chapterLikeCount,
        dislike: chapterDislikeCount,
        score: chapterScore,
        userReaction,
      };

      // Optimistic update
      let nextLike = Math.max(0, Number(prev.like) || 0);
      let nextDislike = Math.max(0, Number(prev.dislike) || 0);
      if (prev.userReaction === "like") nextLike = Math.max(0, nextLike - 1);
      if (prev.userReaction === "dislike") nextDislike = Math.max(0, nextDislike - 1);
      if (reaction === "like") nextLike += 1;
      else nextDislike += 1;

      setIsSubmittingReaction(true);
      setUserReaction(reaction);
      setChapterLikeCount(nextLike);
      setChapterDislikeCount(nextDislike);
      setChapterScore(calcChapterScore(nextLike, nextDislike));

      try {
        const formData = new FormData();
        if (chapterIdResolved) formData.append("chapterId", chapterIdResolved);
        if (mangaIdResolved) formData.append("mangaId", mangaIdResolved);
        if (mangaSlugResolved) formData.append("mangaSlug", mangaSlugResolved);
        if (chapterSlugResolved) formData.append("chapterSlug", chapterSlugResolved);
        if (Number.isFinite(chapterNumberResolved)) formData.append("chapterNumber", String(chapterNumberResolved));
        formData.append("reaction", reaction);

        const res = await fetch("/api/chapter/reaction", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        const data: any = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          const message =
            (data && (data.error || data.message)) ||
            (res.status === 401 ? "Vui lòng đăng nhập để đánh giá chương" : "Có lỗi xảy ra");
          throw new Error(String(message));
        }

        setChapterLikeCount(Math.max(0, Number(data.like) || 0));
        setChapterDislikeCount(Math.max(0, Number(data.dislike) || 0));
        setChapterScore(Number(data.chapScore) || 0);
        setUserReaction((data.userReaction as any) ?? null);
      } catch (e: any) {
        setChapterLikeCount(prev.like);
        setChapterDislikeCount(prev.dislike);
        setChapterScore(prev.score);
        setUserReaction(prev.userReaction);
        toast.error(String(e?.message || "Có lỗi xảy ra"));
      } finally {
        setIsSubmittingReaction(false);
      }
    },
    [
      isLoggedIn,
      chapterIdResolved,
      mangaIdResolved,
      chapterSlugResolved,
      isSubmittingReaction,
      userReaction,
      chapterLikeCount,
      chapterDislikeCount,
      chapterScore,
    ],
  );

  // === Derive nearest existing prev/next from chapters list ===
  const sortedChapterNumbers = useMemo(() => {
    const nums = chapters
      .map((c) => Number(c.value))
      .filter((n) => Number.isFinite(n));
    // unique + sort asc
  const set = new Set<number>(nums);
  return Array.from(set).sort((a: number, b: number) => a - b);
  }, [chapters]);

  const derivedNeighbors = useMemo(() => {
    const current = Number(chapter?.chapterNumber ?? NaN);
    if (!Number.isFinite(current) || sortedChapterNumbers.length === 0)
      return { prevNumber: undefined as number | undefined, nextNumber: undefined as number | undefined };

    // find insertion index
  let idx = sortedChapterNumbers.findIndex((n: number) => n === current);
    if (idx === -1) {
      // if current is missing, find where it would be inserted
  idx = sortedChapterNumbers.findIndex((n: number) => n > current);
      if (idx === -1) idx = sortedChapterNumbers.length; // larger than all
    }
    const prevNumber = sortedChapterNumbers[idx - 1];
    const nextNumber = sortedChapterNumbers[idx + (sortedChapterNumbers[idx] === current ? 1 : 0)] ?? sortedChapterNumbers[idx];
    // Ensure strictly greater for next
  const nextStrict = nextNumber !== undefined && nextNumber > current ? nextNumber : sortedChapterNumbers.find((n: number) => n > current);
    return { prevNumber, nextNumber: nextStrict };
  }, [sortedChapterNumbers, chapter?.chapterNumber]);

  const hasPrevFromList = typeof derivedNeighbors.prevNumber === "number";
  const hasNextFromList = typeof derivedNeighbors.nextNumber === "number";
  const serverPrev = typeof (chapter as any)?.previousChapterNumber === "number" ? (chapter as any).previousChapterNumber as number : undefined;
  const serverNext = typeof (chapter as any)?.nextChapterNumber === "number" ? (chapter as any).nextChapterNumber as number : undefined;
  const prevTarget = hasPrevFromList ? derivedNeighbors.prevNumber : serverPrev;
  const nextTarget = hasNextFromList ? derivedNeighbors.nextNumber : serverNext;

  const serverPrevSlug = typeof (chapter as any)?.previousChapterSlug === "string" ? (chapter as any).previousChapterSlug as string : undefined;
  const serverNextSlug = typeof (chapter as any)?.nextChapterSlug === "string" ? (chapter as any).nextChapterSlug as string : undefined;
  const mangaHandleForReader = (chapter.mangaSlug || mangaIdResolved || "").trim();

  const slugForNumber = useCallback(
    (n?: number) => {
      if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
      const hit = chapters.find((c) => Number(c.value) === n);
      return typeof hit?.slug === "string" && hit.slug.trim() ? hit.slug.trim() : undefined;
    },
    [chapters],
  );

  const prevSlug = slugForNumber(prevTarget) ?? serverPrevSlug;
  const nextSlug = slugForNumber(nextTarget) ?? serverNextSlug;
  const hasPrevChapter = typeof prevTarget === "number" && !!prevSlug;
  const hasNextChapter = typeof nextTarget === "number" && !!nextSlug;
  const reportTargetId = chapterIdResolved || mangaIdResolved;
  const reportTargetName =
    chapter?.title?.trim()
      ? `${chapter.title} — Chap ${chapter.chapterNumber ?? "?"}`
      : `Chap ${chapter.chapterNumber ?? "?"}`;

  const navigateToChapter = useCallback((target?: number, slugOverride?: string) => {
    if (!mangaHandleForReader) return;
    const targetSlug = (slugOverride || slugForNumber(target) || "").trim();
    if (!targetSlug) return;
    navigate(`/truyen-hentai/${mangaHandleForReader}/${encodeURIComponent(targetSlug)}`);
  }, [mangaHandleForReader, navigate, slugForNumber]);

  // Reset states khi chuyển chapter
  useEffect(() => {
    setLoadedImages(new Set());
    setHasCompletedReading(false);
    setReadingStartTime(Date.now());
    setHasClaimedThisChapter(false);
    setViewportIndex(0);

    if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current);

    const time = 60000;
    readingTimerRef.current = setTimeout(() => {
      if (!isLoggedIn) return;
      if (!hasClaimedThisChapter && isEnableClaimGold && rewardEligibility?.canClaim) {
        const formData = new FormData();
        formData.append("intent", "claim-reading-reward");
          try {
            const cid = String((chapter as any)?.id ?? "");
            if (cid) formData.append("chapterId", cid);
          } catch {}
        rewardFetcher.submit(formData, {
          method: "POST",
          action: "/api/reading-reward",
        });
      }
    }, time);

    return () => {
      if (readingTimerRef.current) clearTimeout(readingTimerRef.current);
      if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current);
    };
  }, [chapter.id]);

  // Luôn cuộn lên đầu trang khi chuyển chương (dropdown, trái/phải, đổi URL)
  useEffect(() => {
    // chạy sau khi DOM đã cập nhật khung chương mới
    const rafId = window.requestAnimationFrame(() => {
      try {
        if (typeof window !== "undefined" && window.history && "scrollRestoration" in window.history) {
          try {
            // đảm bảo không giữ vị trí cuộn cũ
            (window.history as any).scrollRestoration = "manual";
          } catch {}
        }
      } catch {}
      // cuộn tức thì về đầu
      try { window.scrollTo({ top: 0, behavior: "auto" }); } catch { window.scrollTo(0, 0); }
      // fallback bổ sung cho một số trình duyệt
      try { document.documentElement.scrollTop = 0; } catch {}
      try { (document.body as any).scrollTop = 0; } catch {}
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [chapter?.id, chapter?.chapterNumber]);
    // ==== POST tiến độ đọc (ghi lại chương đang đọc) ====
  useEffect(() => {
    const mId = String(chapter?.mangaId ?? "");
    const cNum = Number(chapter?.chapterNumber ?? 0);

    // Dữ liệu không hợp lệ thì bỏ
    if (!mId || !Number.isFinite(cNum) || cNum < 1) return;

    // Luôn lưu local để hỗ trợ "Đọc tiếp" cho cả khách.
    try {
      localStorage.setItem(
        `manga_progress_${mId}`,
        JSON.stringify({ chapterNumber: cNum, updatedAt: new Date().toISOString() })
      );
    } catch {}

    // CPU-first: không sync per-chapter lên server.
    // Chỉ đẩy event vào queue để flush theo lô.
    enqueueReadingEvent({
      mangaId: mId,
      chapterId: chapterIdResolved || undefined,
      chapterNumber: cNum,
      ts: Date.now(),
    });
  }, [chapter?.mangaId, chapter?.chapterNumber, chapterIdResolved]);
  // ==== END POST tiến độ đọc ====

// ==== POST tăng view CHỈ KHI user ở trang đủ 60 giây (liền mạch, pause/resume) ====
useEffect(() => {
  const id = chapterIdResolved;
  const hasFallback = Boolean(chapter?.mangaId && chapter?.chapterNumber);
  if (!id && !hasFallback) return;

  const chapterViewKey = `vh:chapter-view:${chapterIdentity}`;
  if (isRecentlyMarkedInSession(chapterViewKey, CHAPTER_VIEW_POST_COOLDOWN_MS)) {
    return;
  }

  const REQUIRED = 30_000; // 30s visible liên tục
  let accumulated = 0;
  let visibleStart: number | null = null;
  let timeoutId: number | null = null;
  let posted = false;

  const postViewOnce = async () => {
    if (posted) return;
    if (isRecentlyMarkedInSession(chapterViewKey, CHAPTER_VIEW_POST_COOLDOWN_MS)) {
      posted = true;
      return;
    }
    posted = true;

    const mangaId = String(chapter?.mangaId || "").trim();
    if (!mangaId) {
      posted = false;
      return;
    }

    enqueueReadingEvent({
      mangaId,
      chapterId: id ? String(id) : undefined,
      chapterNumber: Number.isFinite(Number(chapter?.chapterNumber)) ? Number(chapter?.chapterNumber) : undefined,
      ts: Date.now(),
    });
    markSessionTimestamp(chapterViewKey);
  };

  const clearRunTimer = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const startRunTimerFor = (ms: number) => {
    clearRunTimer();
    timeoutId = window.setTimeout(() => {
      postViewOnce();
      clearRunTimer();
    }, ms);
  };

  const handleVisible = () => {
    if (posted) return;
    visibleStart = performance.now();
    const remaining = Math.max(0, REQUIRED - accumulated);
    startRunTimerFor(remaining);
  };

  const handleHidden = () => {
    if (visibleStart !== null) {
      accumulated += performance.now() - visibleStart;
      visibleStart = null;
    }
    clearRunTimer();
  };

  // Khởi động theo trạng thái hiện tại
  if (document.visibilityState === "visible") {
    handleVisible();
  }

  const onVis = () => {
    if (document.visibilityState === "visible") handleVisible();
    else handleHidden();
  };
  document.addEventListener("visibilitychange", onVis);

  return () => {
    document.removeEventListener("visibilitychange", onVis);
    handleHidden();
  };
}, [chapterIdResolved, chapter?.mangaId, chapter?.chapterNumber, chapterIdentity]);
// ==== END POST tăng view sau 60s ====

// ==== FLUSH batch reading events (CPU-first) ====
useEffect(() => {
  let flushing = false;

  const flushReadingEvents = async (reason: string) => {
    if (flushing) return;
    if (!shouldFlushReadingEvents()) return;

    const queue = readReadingEventsQueue();
    if (!queue.length) return;

    const payload = JSON.stringify({
      reason,
      events: queue.slice(-READING_EVENTS_QUEUE_MAX).map((event) => ({
        mangaId: event.mangaId,
        chapterId: event.chapterId,
        chapterNumber: event.chapterNumber,
        ts: event.ts,
      })),
    });

    flushing = true;
    try {
      let accepted = false;

      if (reason !== "interval" && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([payload], { type: "application/json" });
        accepted = navigator.sendBeacon("/api/reading-events-batch", blob);
      }

      if (!accepted) {
        const res = await fetch("/api/reading-events-batch", {
          method: "POST",
          body: payload,
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          keepalive: reason !== "interval",
          cache: "no-store",
        });
        accepted = res.ok;
      }

      if (accepted) {
        writeReadingEventsQueue([]);
        markReadingEventsFlushedNow();
      }
    } catch {
      // keep queue for next flush attempt
    } finally {
      flushing = false;
    }
  };

  const intervalId = window.setInterval(() => {
    flushReadingEvents("interval");
  }, READING_EVENTS_FLUSH_INTERVAL_MS);

  const onPageHide = () => {
    flushReadingEvents("pagehide");
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      flushReadingEvents("hidden");
    }
  };

  window.addEventListener("pagehide", onPageHide);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    window.clearInterval(intervalId);
    window.removeEventListener("pagehide", onPageHide);
    document.removeEventListener("visibilitychange", onVisibility);
    flushReadingEvents("unmount");
  };
}, []);
// ==== END FLUSH batch reading events ====


  const handleImageLoad = (url: string) => {
    setLoadedImages((prev) => new Set([...prev, url]));
  };

  const allImagesLoaded = loadedImages.size === chapter.contentUrls.length;

  useEffect(() => {
    if (!lastImageRef.current || !allImagesLoaded) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5)
            handleReadingCompletion();
        });
      },
      { threshold: 0.5, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(lastImageRef.current);
    return () => observer.disconnect();
  }, [allImagesLoaded, hasCompletedReading]);

  // Cấu hình khoảng tiền tải (rootMargin) theo thiết bị
  const isDesktopWide = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(min-width: 1024px)").matches;
  const computedRootMargin = isDesktopWide ? "4000px" : "3000px";

  // Preload first image to prioritize rendering the first page quickly
  useEffect(() => {
    const urls = chapter.contentUrls?.slice(0, 3) ?? [];
    if (!urls.length) return;
    const links: HTMLLinkElement[] = [];
    urls.forEach((url, idx) => {
      if (!url) return;
      const link = document.createElement("link");
      link.rel = "preload";
      // @ts-ignore as DOM property assignment
      link.as = "image";
      link.href = url;
      link.setAttribute("data-prefetch", `chapter-image-${idx}`);
      document.head.appendChild(link);
      links.push(link);
    });
    return () => {
      links.forEach((link) => {
        try {
          document.head.removeChild(link);
        } catch {}
      });
    };
  }, [chapter.contentUrls]);

  const handleReadingCompletion = () => {
    if (!isLoggedIn) return;
    if (hasCompletedReading || !readingStartTime) return;
    const now = Date.now();
    const readingDuration = now - readingStartTime;
    const minimumReadingTime = 60000;
    if (readingDuration < minimumReadingTime) {
      const remainingTime = minimumReadingTime - readingDuration;
      completionTimeoutRef.current = setTimeout(
        () => submitReadingExp(),
        remainingTime,
      );
    } else {
      completionTimeoutRef.current = setTimeout(
        () => submitReadingExp(),
        2000 + Math.random() * 1000,
      );
    }
  };

  const submitReadingExp = () => {
    if (hasCompletedReading) return;
    if (!isLoggedIn) {
      // Khách: không gửi request (tránh 401 spam), nhưng vẫn coi như đã hoàn tất để không schedule lại.
      setHasCompletedReading(true);
      return;
    }
    const targetChapterId = chapterIdResolved || chapter.id;
    if (!targetChapterId) return;
    const formData = new FormData();
    formData.append("intent", "claim-reading-exp");
    formData.append("chapterId", targetChapterId);
    expFetcher.submit(formData, { method: "POST", action: "/api/reading-exp" });
  };

  const handleReportSubmit = async (content: string) => {
    if (!reportTargetId) {
      const message = "Không xác định được chương cần báo lỗi";
      toast.error(message);
      throw new Error(message);
    }

    const formData = new FormData();
    formData.append("intent", "create-report");
    formData.append("reason", content);
    formData.append("targetId", reportTargetId);
    formData.append("targetName", reportTargetName);
    formData.append("reportType", REPORT_TYPE.MANGA);
    if (mangaIdResolved) {
      formData.append("mangaId", mangaIdResolved);
    }

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success) {
        const message = data?.error || "Không thể gửi báo cáo";
        toast.error(message);
        throw new Error(message);
      }

      toast.success("Báo cáo đã được gửi");
    } catch (error) {
      if (!(error instanceof Error)) {
        toast.error("Có lỗi xảy ra khi gửi báo cáo");
      }
      console.error("[chapter-report] submit failed", error);
      throw error;
    }
  };

  const handleChapterSelect = (chapterNumber: number) => {
    navigateToChapter(chapterNumber);
  };

  // Giới hạn chiều dài hiển thị tiêu đề chương trên nút dropdown (sticky bottom & static bar)
  const truncateTitle = (s: string, limit: number) => (s.length > limit ? s.slice(0, limit).trimEnd() + "…" : s);
  const isDesktop = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(min-width: 1024px)").matches;
  const titleLimit = isDesktop ? 80 : 10; // desktop: 80, mobile: 10
  const breadcrumbLabelLimit = isDesktop ? 40 : 20; // desktop: x2, mobile giữ nguyên
  const buttonLabel = truncateTitle(displayTitle, titleLimit);
  const renderChapterOption = (opt: any) => String(opt?.label ?? "");

  const scrollToTop = () =>
    window.scrollTo({ top: 0, behavior: "smooth" });

  // 🔧 Modified: scrollToBottom aligns "Có thể bạn sẽ thích" to top viewport
  const scrollToBottom = () => {
    const alignToTop = () => {
      const el = relatedRef.current as HTMLElement | null;
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const absoluteTop = (window.scrollY || 0) + rect.top;
      window.scrollTo({ top: Math.max(0, absoluteTop), behavior: "smooth" });
      return true;
    };

    // If anchor exists now, align immediately
    if (alignToTop()) return;

    // Fallback: scroll near bottom to trigger lazy mount, then align precisely
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });

    // Poll briefly for the ref to mount, then correct the final position
    const startedAt = performance.now();
    const MAX_WAIT = 1200; // ms
    const tick = () => {
      if (alignToTop()) return;
      if (performance.now() - startedAt > MAX_WAIT) return; // give up silently
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const handleImageVisible = useCallback((index: number) => {
    setViewportIndex((prev) => (index === prev ? prev : index));
  }, []);

  const currentPageDisplay = Math.max(1, Math.min(totalPages, horizontalPageIndex + 1));
  const shouldHideBottomBar = hideBottomBar;

  return (
    <>
      <Toaster position="bottom-right" />
      {/* Community CTA */}
      <div className="mx-auto mb-4 flex w-full max-w-[1080px] justify-center px-4 sm:px-6 lg:px-0">
        <div className="relative z-20 flex justify-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="text-txt-primary text-center font-sans text-base font-medium">
              Truy cập{" "}
              <a
                href="https://vinahentai.one"
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="text-[17px] font-semibold text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.85)] hover:text-green-300"
              >
                Vinahentai.one
              </a>
              {" "}khi <span className="font-semibold text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.9)]">bị chặn/web sập</span>.
              <span>{"\u00A0\u00A0\u00A0"}</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <a
                href="https://discord.gg/equKSnEDUB"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Tham gia Discord"
                className="flex items-center justify-center gap-2.5 rounded-xl bg-[#5865F2] px-4 py-3 shadow transition-all hover:scale-105"
              >
                <img
                  src="/images/icons/discord-white.svg"
                  alt=""
                  className="h-5 w-5"
                  aria-hidden="true"
                />
                <span className="font-sans text-sm font-semibold text-white">
                  Tham gia Discord
                </span>
              </a>
              <a
                href="https://www.facebook.com/groups/2994904437381840/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Vào Group Facebook"
                className="flex items-center justify-center gap-2.5 rounded-xl bg-[#1877F2] px-4 py-3 shadow transition-all hover:scale-105"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.099 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.007 1.792-4.669 4.533-4.669 1.313 0 2.686.235 2.686.235v2.953h-1.514c-1.491 0-1.956.929-1.956 1.882v2.259h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.099 24 12.073z" />
                </svg>
                <span className="font-sans text-sm font-semibold text-white">
                  <span className="sm:hidden">Facebook</span>
                  <span className="hidden sm:inline">Vào Group Facebook</span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-bgc-layer1 border-bd-default mx-auto flex w-full max-w-[1080px] flex-col gap-4 rounded-xl border p-4 sm:p-6 isolate">
        <div className="flex flex-col gap-2">
          <nav
            aria-label="Breadcrumb"
            className="text-txt-focus font-sans text-sm font-medium"
          >
            <ol className="flex flex-wrap items-center gap-0.5 sm:gap-1">
              {normalizedBreadcrumbItems.map((item, index) => {
                const isLast = index === normalizedBreadcrumbItems.length - 1;
                const originalLabel = String(item.label ?? "");
                const truncated = truncateBreadcrumbLabel(originalLabel, breadcrumbLabelLimit);
                return (
                  <li key={`${item.label}-${index}`} className="flex items-center gap-0.5 sm:gap-1">
                    {item.href && !isLast ? (
                      <Link
                        to={item.href}
                        className="transition-colors hover:text-lav-500"
                        title={originalLabel}
                      >
                        {truncated}
                      </Link>
                    ) : (
                      <span className={isLast ? "text-txt-focus" : "text-txt-secondary"} title={originalLabel}>
                        {truncated}
                      </span>
                    )}
                    {!isLast && <span className="text-txt-secondary/60 px-0.5">/</span>}
                  </li>
                );
              })}
            </ol>
          </nav>
          <div className="text-txt-primary font-sans text-2xl font-semibold leading-loose">
            {displayTitle}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-0 -mx-4 my-6 flex flex-col items-center justify-center overflow-x-hidden sm:mx-0 sm:my-8">
        <div className="mb-3 flex w-full max-w-[1080px] items-center justify-center px-2 transition-opacity duration-200 sm:px-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsReaderSettingsOpen((prev) => !prev);
              }}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0B0F1A]/85 px-3 py-2 text-sm font-medium text-white/90"
              aria-label="Cài đặt chế độ đọc"
            >
              <Settings className="h-4 w-4" />
              <span>Cài đặt chế độ đọc</span>
            </button>

            {!isMobileViewport && isReaderSettingsOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[280px] rounded-2xl border border-white/10 bg-[#0B0F1A] p-4 shadow-2xl">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">Cài đặt chế độ đọc</div>
                  <button
                    type="button"
                    onClick={() => setIsReaderSettingsOpen(false)}
                    className="rounded-lg border border-white/10 p-1.5 text-white/80"
                    aria-label="Đóng cài đặt"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-3 text-sm text-white/90">
                  <div>
                    <div className="mb-1 text-white/70">Chế độ đọc</div>
                    <div className="space-y-1">
                      <button type="button" onClick={() => setReaderMode("vertical")} className={`w-full rounded-lg border px-3 py-2 text-left ${readerMode === "vertical" ? "border-lav-500 bg-white/10 text-lav-500" : "border-white/10 text-white/90"}`}>↕ Dọc</button>
                      <button type="button" onClick={() => setReaderMode("horizontal")} className={`w-full rounded-lg border px-3 py-2 text-left ${readerMode === "horizontal" ? "border-lav-500 bg-white/10 text-lav-500" : "border-white/10 text-white/90"}`}>↔ Ngang</button>
                    </div>
                  </div>

                  {readerMode === "horizontal" && (
                    <div>
                      <div className="mb-1 text-white/70">Hướng đọc</div>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setHorizontalDirection("ltr")} className={`rounded-lg border px-3 py-2 ${horizontalDirection === "ltr" ? "border-lav-500 bg-white/10 text-lav-500" : "border-white/10 text-white/90"}`}>→ Trái sang phải</button>
                        <button type="button" onClick={() => setHorizontalDirection("rtl")} className={`rounded-lg border px-3 py-2 ${horizontalDirection === "rtl" ? "border-lav-500 bg-white/10 text-lav-500" : "border-white/10 text-white/90"}`}>← Phải sang trái</button>
                      </div>
                    </div>
                  )}

                  {readerMode === "horizontal" && (
                    <div>
                      <div className="mb-1 text-white/70">Hiển thị trang</div>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setDesktopPageSpread(1)} className={`rounded-lg border px-3 py-2 ${desktopPageSpread === 1 ? "border-lav-500 bg-white/10 text-lav-500" : "border-white/10 text-white/90"}`}>
                          <span className="inline-flex items-center gap-2">
                            <span aria-hidden="true" className="inline-flex h-4 w-3 rounded-[2px] border border-current" />
                            <span>1 trang</span>
                          </span>
                        </button>
                        <button type="button" onClick={() => setDesktopPageSpread(2)} className={`rounded-lg border px-3 py-2 ${desktopPageSpread === 2 ? "border-lav-500 bg-white/10 text-lav-500" : "border-white/10 text-white/90"}`}>
                          <span className="inline-flex items-center gap-2">
                            <span aria-hidden="true" className="inline-flex items-center gap-0.5">
                              <span className="inline-flex h-4 w-3 rounded-[2px] border border-current" />
                              <span className="inline-flex h-4 w-3 rounded-[2px] border border-current" />
                            </span>
                            <span>2 trang</span>
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {readerMode === "vertical" ? (
          chapter.contentUrls.map((url, index) => {
            const isLastImage = index === chapter.contentUrls.length - 1;
            const isImageLoaded = loadedImages.has(url);
            const eager = index === 0;
            const isHighPriority = Math.abs(index - viewportIndex) <= 1;
            const fetchPriority = isHighPriority ? "high" : (index === 0 ? "high" : "low");
            const decodeBeforeDisplay = index <= viewportIndex + 3;
            return (
              <div key={url} className="w-full max-w-[1080px]">
                <div
                  className="relative flex w-full items-center justify-center"
                  style={isImageLoaded ? undefined : { minHeight: "600px" }}
                >
                  {!isImageLoaded && (
                    <div className="absolute inset-0 rounded-xl bg-[rgba(255,255,255,0.02)]" />
                  )}

                  <LazyImage
                    ref={isLastImage ? lastImageRef : undefined}
                    src={url}
                    alt={`Chapter ${index + 1}`}
                    className={`w-full ${isImageLoaded ? "opacity-100" : "opacity-0"}`}
                    eager={eager}
                    rootMargin={computedRootMargin}
                    fetchPriority={fetchPriority as any}
                    priority={isHighPriority ? "high" : "low"}
                    decodeBeforeDisplay={decodeBeforeDisplay}
                    onVisible={() => handleImageVisible(index)}
                    onLoad={() => handleImageLoad(url)}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div className="relative w-full max-w-[1080px]">
            <div
              ref={horizontalReaderRef}
              onPointerDown={handleHorizontalPointerDown}
              onPointerUp={handleHorizontalPointerUp}
              className={`relative flex w-full touch-pan-y items-center justify-center overflow-hidden rounded-xl ${isMobileViewport ? "min-h-[68vh] bg-black" : "h-[100vh] bg-transparent"}`}
            >
              <div className={`grid w-full gap-2 ${horizontalDisplayedUrls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                {horizontalDisplayedUrls.map((url, idx) => (
                  <div key={`${url}-${idx}`} className="flex items-center justify-center">
                    <img
                      src={url}
                      alt={`Trang ${horizontalPageIndex + idx + 1}`}
                      className={isMobileViewport ? "max-h-[88vh] w-auto max-w-full object-contain" : "h-[100vh] w-auto object-contain"}
                      loading={idx === 0 ? "eager" : "lazy"}
                      decoding="async"
                      draggable={false}
                    />
                  </div>
                ))}
              </div>

              {!isMobileViewport && (
                <>
                  <button
                    type="button"
                    aria-label="Trang trước"
                    onClick={handleLeftAction}
                    className="absolute inset-y-0 left-0 w-1/4 cursor-pointer bg-transparent"
                  />
                  <button
                    type="button"
                    aria-label="Trang sau"
                    onClick={handleRightAction}
                    className="absolute inset-y-0 right-0 w-1/4 cursor-pointer bg-transparent"
                  />
                </>
              )}
            </div>

            <div className="mt-2 w-full px-2 sm:px-0">
              <div className="mx-auto w-full max-w-[1080px] rounded-xl border border-white/10 bg-[#0B0F1A]/90 p-2 backdrop-blur">
                <div className="mb-1 text-center text-xs font-semibold text-white/80">
                  {currentPageDisplay} / {Math.max(totalPages, 1)}
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(totalPages - 1, 0)}
                  step={effectivePageSpread}
                  value={horizontalPageIndex}
                  onChange={(e) => {
                    setHorizontalPageIndex(clampPageIndex(Number(e.target.value)));
                  }}
                  className="w-full accent-blue-500"
                  aria-label="Tiến độ trang"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {isMobileViewport && isReaderSettingsOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-50 bg-black/40"
            onClick={() => setIsReaderSettingsOpen(false)}
            aria-label="Đóng cài đặt"
          />
          <div className="fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl border-t border-white/10 bg-[#0B0F1A] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-base font-semibold text-white">Cài đặt chế độ đọc</div>
              <button type="button" onClick={() => setIsReaderSettingsOpen(false)} className="rounded-lg border border-white/10 p-2 text-white/80" aria-label="Đóng">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-white/90">
              <div>
                <div className="mb-1 text-white/70">Chế độ đọc</div>
                <div className="space-y-1">
                  <button type="button" onClick={() => setReaderMode("vertical")} className={`w-full rounded-lg border px-3 py-2 text-left ${readerMode === "vertical" ? "border-lav-500 bg-white/10 text-lav-500" : "border-white/10 text-white/90"}`}>↕ Dọc</button>
                  <button type="button" onClick={() => setReaderMode("horizontal")} className={`w-full rounded-lg border px-3 py-2 text-left ${readerMode === "horizontal" ? "border-lav-500 bg-white/10 text-lav-500" : "border-white/10 text-white/90"}`}>↔ Ngang</button>
                </div>
              </div>

              {readerMode === "horizontal" && (
                <div>
                  <div className="mb-1 text-white/70">Hướng đọc</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setHorizontalDirection("ltr")} className={`rounded-lg border px-3 py-2 ${horizontalDirection === "ltr" ? "border-lav-500 bg-white/10 text-lav-500" : "border-white/10 text-white/90"}`}>→ Trái sang phải</button>
                    <button type="button" onClick={() => setHorizontalDirection("rtl")} className={`rounded-lg border px-3 py-2 ${horizontalDirection === "rtl" ? "border-lav-500 bg-white/10 text-lav-500" : "border-white/10 text-white/90"}`}>← Phải sang trái</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Static navigation + report (under content) */}
      <div className="mx-auto mb-6 flex w-full max-w-[1080px] flex-col gap-2 px-0">
        <div className="rounded-2xl border border-white/10 bg-[#05070F] px-0 py-0 shadow-none w-full">
          {/* Mobile: 1 row with fixed proportions (23/20/14/20/23) */}
          <div className="grid w-full grid-cols-[23fr_20fr_14fr_20fr_23fr] gap-2 px-2 pt-2 sm:hidden">
            <button
              type="button"
              disabled={!hasPrevChapter}
              onClick={() => navigateToChapter(prevTarget, prevSlug)}
              className={`flex h-10 w-full items-center justify-center rounded-xl border px-0 py-0 text-sm font-semibold transition-all ${
                hasPrevChapter
                  ? "border-transparent bg-gradient-to-b from-[#DD94FF] to-[#D373FF] text-bgc-layer1 shadow-[0px_4px_8.9px_0px_rgba(196,69,255,0.25)] hover:brightness-105"
                  : "border-white/10 bg-[#141727] text-white/40 cursor-not-allowed opacity-70"
              }`}
              aria-label="Chương trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => submitReaction("like")}
              disabled={!isLoggedIn || isSubmittingReaction}
              className={[
                "flex h-10 w-full min-w-0 items-center justify-center gap-1 rounded-xl border px-2 text-xs font-semibold transition-all",
                userReaction === "like"
                  ? "border-transparent bg-gradient-to-b from-[#DD94FF] to-[#D373FF] text-bgc-layer1"
                  : "border-white/10 bg-[#141727] text-white/80 hover:bg-[#1b1f33]",
                (!isLoggedIn || isSubmittingReaction) ? "opacity-70" : "",
              ].join(" ")}
              aria-pressed={userReaction === "like"}
              aria-label="Like chương"
              title={!isLoggedIn ? "Đăng nhập để đánh giá" : undefined}
            >
              <ThumbsUp className="h-4 w-4 text-green-500" />
              <span className="tabular-nums">{(chapterLikeCount ?? 0).toLocaleString("vi-VN")}</span>
            </button>

            <div
              className="flex h-10 w-full items-center justify-center rounded-xl border border-white/10 bg-[#141727] px-1 text-[11px] font-semibold tabular-nums text-white/80"
              aria-label="Điểm chương"
              title="Điểm chương"
            >
              {(() => {
                const votes = (chapterLikeCount || 0) + (chapterDislikeCount || 0);
                if (votes < CHAPTER_RATING_CONFIG.minVotesToDisplay) return "0.0/0";
                return `${(Number(chapterScore) || 0).toFixed(1)}/10`;
              })()}
            </div>

            <button
              type="button"
              onClick={() => submitReaction("dislike")}
              disabled={!isLoggedIn || isSubmittingReaction}
              className={[
                "flex h-10 w-full min-w-0 items-center justify-center gap-1 rounded-xl border px-2 text-xs font-semibold transition-all",
                userReaction === "dislike"
                  ? "border-transparent bg-gradient-to-b from-[#DD94FF] to-[#D373FF] text-bgc-layer1"
                  : "border-white/10 bg-[#141727] text-white/80 hover:bg-[#1b1f33]",
                (!isLoggedIn || isSubmittingReaction) ? "opacity-70" : "",
              ].join(" ")}
              aria-pressed={userReaction === "dislike"}
              aria-label="Dislike chương"
              title={!isLoggedIn ? "Đăng nhập để đánh giá" : undefined}
            >
              <ThumbsDown className="h-4 w-4 text-red-500" />
              <span className="tabular-nums">{(chapterDislikeCount ?? 0).toLocaleString("vi-VN")}</span>
            </button>

            <button
              type="button"
              disabled={!hasNextChapter}
              onClick={() => navigateToChapter(nextTarget, nextSlug)}
              className={`flex h-10 w-full items-center justify-center rounded-xl border px-0 py-0 text-sm font-semibold transition-all ${
                hasNextChapter
                  ? "border-transparent bg-gradient-to-b from-[#DD94FF] to-[#D373FF] text-bgc-layer1 shadow-[0px_4px_8.9px_0px_rgba(196,69,255,0.25)] hover:brightness-105"
                  : "border-white/10 bg-[#141727] text-white/40 cursor-not-allowed opacity-70"
              }`}
              aria-label="Chương sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Desktop/tablet: keep existing layout */}
          <div className="hidden w-full grid-cols-3 gap-2 px-2 pt-2 sm:grid">
            <button
              type="button"
              disabled={!hasPrevChapter}
              onClick={() => navigateToChapter(prevTarget, prevSlug)}
              className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl border px-0 py-0 text-sm font-semibold transition-all ${
                hasPrevChapter
                  ? "border-transparent bg-gradient-to-b from-[#DD94FF] to-[#D373FF] text-bgc-layer1 shadow-[0px_4px_8.9px_0px_rgba(196,69,255,0.25)] hover:brightness-105"
                  : "border-white/10 bg-[#141727] text-white/40 cursor-not-allowed opacity-70"
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Chương trước</span>
            </button>

            <div className="flex w-full flex-col items-center justify-center rounded-xl border border-transparent bg-[#0B0F1A]/60 px-2 py-1">
              <div className="flex w-full items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => submitReaction("like")}
                  disabled={!isLoggedIn || isSubmittingReaction}
                  className={[
                    "flex items-center justify-center gap-2 rounded-lg border px-2 py-2 text-sm font-semibold transition-all",
                    "w-[110px]",
                    userReaction === "like"
                      ? "border-transparent bg-gradient-to-b from-[#DD94FF] to-[#D373FF] text-bgc-layer1"
                      : "border-white/10 bg-[#141727] text-white/80 hover:bg-[#1b1f33]",
                    (!isLoggedIn || isSubmittingReaction) ? "opacity-70" : "",
                  ].join(" ")}
                  aria-pressed={userReaction === "like"}
                  aria-label="Like chương"
                  title={!isLoggedIn ? "Đăng nhập để đánh giá" : undefined}
                >
                  <ThumbsUp className="h-4 w-4 text-green-500" />
                  <span className="tabular-nums">{(chapterLikeCount ?? 0).toLocaleString("vi-VN")}</span>
                </button>

                <div
                  className={[
                    "flex items-center justify-center rounded-lg border px-2 py-2 text-sm font-semibold tabular-nums",
                    "w-[96px]",
                    "border-white/10 bg-[#141727] text-white/80",
                  ].join(" ")}
                  aria-label="Điểm chương"
                  title="Điểm chương"
                >
                  {(() => {
                    const votes = (chapterLikeCount || 0) + (chapterDislikeCount || 0);
                    if (votes < CHAPTER_RATING_CONFIG.minVotesToDisplay) return "0.0/0";
                    return `${(Number(chapterScore) || 0).toFixed(1)}/10`;
                  })()}
                </div>

                <button
                  type="button"
                  onClick={() => submitReaction("dislike")}
                  disabled={!isLoggedIn || isSubmittingReaction}
                  className={[
                    "flex items-center justify-center gap-2 rounded-lg border px-2 py-2 text-sm font-semibold transition-all",
                    "w-[110px]",
                    userReaction === "dislike"
                      ? "border-transparent bg-gradient-to-b from-[#DD94FF] to-[#D373FF] text-bgc-layer1"
                      : "border-white/10 bg-[#141727] text-white/80 hover:bg-[#1b1f33]",
                    (!isLoggedIn || isSubmittingReaction) ? "opacity-70" : "",
                  ].join(" ")}
                  aria-pressed={userReaction === "dislike"}
                  aria-label="Dislike chương"
                  title={!isLoggedIn ? "Đăng nhập để đánh giá" : undefined}
                >
                  <ThumbsDown className="h-4 w-4 text-red-500" />
                  <span className="tabular-nums">{(chapterDislikeCount ?? 0).toLocaleString("vi-VN")}</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={!hasNextChapter}
              onClick={() => navigateToChapter(nextTarget, nextSlug)}
              className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl border px-0 py-0 text-sm font-semibold transition-all ${
                hasNextChapter
                  ? "border-transparent bg-gradient-to-b from-[#DD94FF] to-[#D373FF] text-bgc-layer1 shadow-[0px_4px_8.9px_0px_rgba(196,69,255,0.25)] hover:brightness-105"
                  : "border-white/10 bg-[#141727] text-white/40 cursor-not-allowed opacity-70"
              }`}
            >
              <span className="hidden sm:inline">Chương sau</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsReportDialogOpen(true)}
            className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-red-500 px-0 py-0 h-10 w-full text-sm font-semibold text-red-400 bg-transparent transition-all shadow-[0px_4px_8.9px_0px_rgba(239,68,68,0.25)] hover:bg-red-500/10"
          >
            <AlertTriangle className="h-4 w-4" />
            Báo mọi lỗi
            <span className="ml-2 text-xs font-normal text-red-300 whitespace-nowrap">(mất ảnh, lỗi ảnh...)</span>
          </button>
        </div>
      </div>

      {/* Bottom control bar pinned to viewport bottom */}
      <div
        ref={barRef}
        className={[
          "fixed bottom-0 left-0 right-0 z-40 w-full will-change-transform transition-transform duration-200 ease-out",
          shouldHideBottomBar ? "translate-y-full" : "translate-y-0",
        ].join(" ")}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          ["--ctrl-size" as any]: "clamp(44px, 8vw, 52px)",
          marginBottom: 0,
        }}
      >
        <div className="mx-auto flex max-w-[1080px] items-center justify-between border-t border-white/10 px-4 py-2 bg-[#0B0F1A]/80 backdrop-blur rounded-t-xl shadow-[0_-6px_16px_-8px_rgba(0,0,0,0.35)]">
            <Link
              to={mangaDetailUrl}
            aria-label="Về trang truyện"
            className="flex items-center justify-center rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] shadow transition-all hover:shadow-lg"
            style={{
              width: "var(--ctrl-size)",
              height: "var(--ctrl-size)",
            }}
          >
            <span aria-hidden="true" className="text-bgc-layer1 text-2xl leading-none">
              🎴
            </span>
          </Link>

          <div className="flex items-center justify-center gap-3">
            <button
              disabled={!hasPrevChapter}
              onClick={() => navigateToChapter(prevTarget, prevSlug)}
              className={`flex items-center justify-center rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] p-3 shadow transition-all ${
                hasPrevChapter
                  ? "cursor-pointer hover:shadow-lg"
                  : "cursor-not-allowed opacity-50"
              }`}
            >
              <ChevronLeft className="text-bgc-layer1 h-5 w-5" />
            </button>

            <Dropdown
              options={chapters}
              value={chapter.chapterNumber}
              placeholder="Chọn chương"
              onSelect={handleChapterSelect}
              className="min-w-[140px]"
              buttonLabel={buttonLabel}
              renderOptionLabel={(o) => renderChapterOption(o as any)}
              menuWidthMultiplier={2}
              placement="up"
            />

            <button
              disabled={!hasNextChapter}
              onClick={() => navigateToChapter(nextTarget, nextSlug)}
              className={`flex items-center justify-center rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] p-3 shadow transition-all ${
                hasNextChapter
                  ? "cursor-pointer hover:shadow-lg"
                  : "cursor-not-allowed opacity-50"
              }`}
            >
              <ChevronRight className="text-bgc-layer1 h-5 w-5" />
            </button>
          </div>

          <div
            className="flex flex-col items-center justify-between rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] shadow overflow-hidden"
            style={{
              width: "var(--ctrl-size)",
              height: "var(--ctrl-size)",
            }}
          >
            <button
              onClick={isInBottomScrollZone ? scrollToTop : scrollToBottom}
              aria-label={isInBottomScrollZone ? "Cuộn lên đầu" : "Cuộn xuống cuối"}
              className="flex h-full w-full items-center justify-center hover:opacity-80"
            >
              {isInBottomScrollZone ? (
                <ArrowUpToLine className="text-bgc-layer1 h-5 w-5" />
              ) : (
                <ArrowDownToLine className="text-bgc-layer1 h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

  {/* 🔧 Modified: Recommended manga now with ref (lazy-mounted) */}
      <LazyRender
        rootMargin="600px"
        placeholder={
          <div className="mt-6">
            <div className="h-8 w-36 rounded bg-[rgba(255,255,255,0.02)] animate-pulse" />
            <div className="mt-4 h-36 w-full rounded bg-[rgba(255,255,255,0.02)] animate-pulse" />
          </div>
        }
        once
      >
        <div ref={relatedRef}>
          {recommendedManga.length > 0 && (
            <RecommendedManga mangaList={recommendedManga} variant="reader-horizontal" />
          )}
        </div>

        {/* 🔹 Bình luận chương truyện (deferred) */}
        <CommentDetail
          mangaId={chapter.mangaId}
          mangaOwnerId={mangaOwnerIdResolved || undefined}
          isLoggedIn={isLoggedIn}
          isAdmin={false}
        />
      </LazyRender>

      <ReportDialog
        isOpen={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
        onSubmit={handleReportSubmit}
      />
    </>
  );
}
