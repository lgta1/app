import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { Eye, Bookmark, BookmarkCheck } from "lucide-react";

import { FEATURED_GENRE_SLUGS } from "~/constants/featured-genres";
import { MANGA_USER_STATUS } from "~/constants/manga";
import type { ChapterType } from "~/database/models/chapter.model";
import type { MangaType } from "~/database/models/manga.model";
import { formatDate, formatTime } from "~/utils/date.utils";
import { getChapterDisplayName } from "../utils/chapter.utils";
import { toSlug } from "~/utils/slug.utils"; // dùng để tạo slug
import { toDisplayView } from "~/utils/display-view.utils";

interface MangaDetailProps {
  manga: MangaType;
  chapters: ChapterType[];
  /** Ẩn toàn bộ nhóm nút hành động (theo dõi, thích, đọc, ...) cho trang preview quản lý */
  hideActions?: boolean;
  /** Ẩn phần danh sách chương (dùng cho trang preview quản lý) */
  hideChaptersList?: boolean;
}

/* ===================== BEGIN <feature> CHIP_STYLES_SURFACE_BLEND ===================== */
/**
 * Mục tiêu: chip hoà vào nền (dark surface) thay vì tách khối đen.
 * - surfaceBlend: dùng cho "Người đăng" (ưu tiên nhẹ, không át CTA)
 * - brandTint: tím trong suốt cho "Tác giả" (nhấn nhận diện)
 * - outlineSubtle: viền mờ cho "Thể loại" (secondary)
 * Tất cả đều có border subtle + hover tăng mờ/sáng rất nhẹ để hợp theme.
 */
const chipBase =
  "inline-flex items-center gap-1.5 rounded-full h-8 px-3 text-sm whitespace-nowrap max-w-[180px] truncate select-none transition-[background,box-shadow,border,color] duration-150";

const chipVariants = {
  /** Hoà nền: bề mặt tối + border subtle + text trắng 90% */
  surfaceBlend:
    `${chipBase} bg-white/5 border border-white/10 text-white/90 ` +
    `hover:bg-white/8 hover:border-white/15 ` +
    `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D373FF]/35`,

  /** Tím trong suốt: tạo điểm nhấn nhẹ cho "Tác giả" */
  brandTint:
    `${chipBase} bg-[rgba(211,115,255,.10)] border border-[rgba(211,115,255,.22)] text-[#EBD7FF] ` +
    `hover:bg-[rgba(211,115,255,.14)] hover:border-[rgba(211,115,255,.30)] ` +
    `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D373FF]/45`,

  /** Viền mờ: dành cho "Thể loại", không chiếm nổi bật */
  outlineSubtle:
    `${chipBase} bg-transparent border border-white/12 text-[#EBD7FF]/90 hover:border-[#D373FF]/35 hover:bg:white/[.04] ` +
    `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D373FF]/30`,
};
/* ====================== END <feature> CHIP_STYLES_SURFACE_BLEND ====================== */

/* ===================== BEGIN <feature> GENRES_CHIPS_POPOVER (7 visible + popover) ===================== */
interface CollapsibleGenreChipsProps {
  genres: string[];
  /** Tùy chọn cũ: số hàng tối đa (không còn dùng trong logic mới theo count) */
  maxRows?: number;
}

interface GenreChipItem {
  label: string;
  slug: string;
  isFeatured: boolean;
}

function CollapsibleGenreChips({ genres }: CollapsibleGenreChipsProps) {
  // Quy tắc mới:
  // - 1–10 thể loại: hiển thị tất cả, không có nút “+N”
  // - >=11 thể loại: hiển thị 8 thể loại đầu, phần còn lại đưa vào popover
  const list: GenreChipItem[] = (Array.isArray(genres) ? genres : []).map((name) => {
    const label = String(name);
    const slug = toSlug(label);
    return { label, slug, isFeatured: FEATURED_GENRE_SLUGS.has(slug) };
  });
  const ordered = list.slice().sort((a, b) => {
    if (a.isFeatured === b.isFeatured) return 0;
    return a.isFeatured ? -1 : 1;
  });
  const showAll = ordered.length <= 10;
  const visible = showAll ? ordered : ordered.slice(0, 8);
  const rest = showAll ? [] : ordered.slice(8);
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!open) return;
      const el = popRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  // Chip thể loại: thiết kế vuông/chữ nhật bo góc, viền sát chữ, kích thước nhỏ gọn
  const genreChipClass =
    "inline-flex items-center rounded-md border border-white/20 px-2 py-1 text-xs leading-tight text-[#EBD7FF]/90 hover:border-[#D373FF]/35 hover:bg-white/[0.04] transition-colors";

  return (
    <div className="relative justify-self-start">
      <div className="flex flex-wrap gap-2">
        {visible.map((g, idx) => {
          const { label, slug } = g;
          return (
            <Link
              key={`${slug}-${idx}`}
              to={`/genres/${slug}`}
              className={genreChipClass + " w-fit"}
              title={label}
              aria-label={`Xem thể loại ${label}`}
            >
              <span className="capitalize">{label}</span>
            </Link>
          );
        })}

        {rest.length > 0 ? (
          <>
            <span aria-hidden className="select-none">… </span>
            <button
              type="button"
              onClick={() => setOpen((v: boolean) => !v)}
              className={genreChipClass + " w-fit text-white/80"}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-label={`Xem thêm ${rest.length} thể loại`}
              title={`Xem thêm ${rest.length} thể loại`}
            >
              +{rest.length}
            </button>
          </>
        ) : null}
      </div>

      {open && rest.length > 0 ? (
        <div
          ref={popRef}
          role="dialog"
          aria-label="Tất cả thể loại"
          className="absolute z-20 mt-2 w-[min(80vw,360px)] rounded-xl border border-white/10 bg-black/80 p-3 shadow-xl backdrop-blur-md"
        >
          <div className="flex flex-wrap gap-2 max-h-[240px] overflow-auto">
            {rest.map((g, idx) => {
              const { label, slug } = g;
              return (
                <Link
                  key={`${slug}-rest-${idx}`}
                  to={`/genres/${slug}`}
                  className={genreChipClass + " w-fit"}
                  title={label}
                  aria-label={`Xem thể loại ${label}`}
                >
                  <span className="capitalize">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
/* ====================== END <feature> GENRES_CHIPS_POPOVER (7 visible + popover) ====================== */

interface CollapsibleCharacterChipsProps {
  names: string[];
  slugs?: string[];
  isMobile?: boolean;
}

interface NameSlugItem {
  label: string;
  slug: string;
}

function CollapsibleCharacterChips({ names, slugs = [], isMobile = false }: CollapsibleCharacterChipsProps) {
  const normalized = (Array.isArray(names) ? names : []).map((name, index) => ({
    label: String(name),
    slug: slugs[index] || toSlug(String(name)),
  }));
  const showAll = normalized.length <= 10;
  const visible = showAll ? normalized : normalized.slice(0, 8);
  const rest = showAll ? [] : normalized.slice(8);
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!open) return;
      const el = popRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (showAll && open) setOpen(false);
  }, [showAll, open]);

  const tagClass = chipVariants.outlineSubtle + " w-fit";

  const renderChip = (key: string, item: { label: string; slug: string }) => {
    if (isMobile) {
      return (
        <a
          key={key}
          href={`/characters/${item.slug}`}
          className={tagClass}
          title={item.label}
          aria-label={`Xem nhân vật ${item.label}`}
        >
          <span className="capitalize">{item.label}</span>
        </a>
      );
    }

    return (
      <Link
        key={key}
        to={`/characters/${item.slug}`}
        className={tagClass}
        title={item.label}
        aria-label={`Xem nhân vật ${item.label}`}
      >
        <span className="capitalize">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="relative justify-self-start">
      <div className="flex flex-wrap gap-2">
        {visible.map((item, idx) => renderChip(`${item.slug}-${idx}`, item))}

        {rest.length > 0 ? (
          <>
            <span aria-hidden className="select-none">… </span>
            <button
              type="button"
              onClick={() => setOpen((v: boolean) => !v)}
              className={tagClass + " text-white/80"}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-label={`Xem thêm ${rest.length} nhân vật`}
              title={`Xem thêm ${rest.length} nhân vật`}
            >
              +{rest.length}
            </button>
          </>
        ) : null}
      </div>

      {open && rest.length > 0 ? (
        <div
          ref={popRef}
          role="dialog"
          aria-label="Tất cả nhân vật"
          className="absolute z-20 mt-2 w-[min(80vw,360px)] rounded-xl border border-white/10 bg-black/80 p-3 shadow-xl backdrop-blur-md"
        >
          <div className="flex flex-wrap gap-2 max-h-[240px] overflow-auto">
            {rest.map((item, idx) => renderChip(`${item.slug}-rest-${idx}`, item))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ===================== BEGIN <util> RELATIVE TIME (numeric, vi-VN) ===================== */
/**
 * Luôn in dạng numeric: "6 phút trước", "6 giờ trước", "5 ngày trước",
 * "1 tuần trước", "2 tháng trước", "3 năm trước". Không dùng "tuần trước/hôm qua"...
 */
function getRelativeTimeNumeric(input?: string | number | Date) {
  if (!input) return "";
  const d = new Date(input);
  if (isNaN(d.getTime())) return "";

  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000); // >0 = quá khứ
  const abs = Math.abs(diffSec);

  const MINUTE = 60;
  const HOUR   = 60 * MINUTE;
  const DAY    = 24 * HOUR;
  const WEEK   = 7 * DAY;
  const MONTH  = 30 * DAY;   // xấp xỉ cho hiển thị
  const YEAR   = 365 * DAY;  // xấp xỉ cho hiển thị

  let value: number;
  let unit: "phút" | "giờ" | "ngày" | "tuần" | "tháng" | "năm";

  if (abs < HOUR) {
    value = Math.max(1, Math.floor(abs / MINUTE));
    unit = "phút";
  } else if (abs < DAY) {
    value = Math.floor(abs / HOUR);
    unit = "giờ";
  } else if (abs < WEEK) {
    value = Math.floor(abs / DAY);
    unit = "ngày";
  } else if (abs < MONTH) {
    value = Math.floor(abs / WEEK);
    unit = "tuần";
  } else if (abs < YEAR) {
    value = Math.floor(abs / MONTH);
    unit = "tháng";
  } else {
    value = Math.floor(abs / YEAR);
    unit = "năm";
  }

  return `${value} ${unit} trước`;
}
/* ====================== END <util> RELATIVE TIME (numeric, vi-VN) ====================== */

export function MangaDetail({ manga, chapters, hideActions, hideChaptersList }: MangaDetailProps) {
  const {
    id,
    code,
    title,
    poster,
    author,
    genres,
    viewNumber,
    description,
    updatedAt,
    followNumber,
    userStatus,
    // translationTeam,  // ❌ không còn dùng
    // ownerId,          // ❌ không còn dùng
  } = manga;

  const alternateTitle = (manga as any)?.alternateTitle ? String((manga as any).alternateTitle).trim() : "";
  // Tác giả có thể rỗng: tính sẵn mảng để ẩn nguyên hàng nếu không có
  const authorItems: NameSlugItem[] = useMemo(() => {
    const names = Array.isArray((manga as any)?.authorNames)
      ? ((manga as any).authorNames as string[])
      : [];
    const slugs = Array.isArray((manga as any)?.authorSlugs)
      ? ((manga as any).authorSlugs as string[])
      : [];

    if (names.length > 0) {
      return names
        .map((name, idx) => {
          const label = String(name || "").trim();
          if (!label) return null;
          const slug = String(slugs[idx] || toSlug(label));
          return { label, slug };
        })
        .filter(Boolean) as NameSlugItem[];
    }

    return String(author || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((label) => ({ label, slug: toSlug(label) }));
  }, [manga, author]);
  const doujinshiNames = Array.isArray((manga as any)?.doujinshiNames) ? (manga as any).doujinshiNames as string[] : [];
  const doujinshiSlugs = Array.isArray((manga as any)?.doujinshiSlugs) ? (manga as any).doujinshiSlugs as string[] : [];
  const translatorNames = Array.isArray((manga as any)?.translatorNames) ? (manga as any).translatorNames as string[] : [];
  const translatorSlugs = Array.isArray((manga as any)?.translatorSlugs) ? (manga as any).translatorSlugs as string[] : [];
  const characterNames = Array.isArray((manga as any)?.characterNames) ? (manga as any).characterNames as string[] : [];
  const characterSlugs = Array.isArray((manga as any)?.characterSlugs) ? (manga as any).characterSlugs as string[] : [];

  // === Hiển thị mô tả: chỉ render khi khác "..." và không rỗng ===
  const safeDesc = typeof description === "string" ? description.trim() : "";
  const shouldShowDesc = !!(safeDesc && safeDesc !== "...");

  const [isFollowing, setIsFollowing] = useState(false);
  const [followCount, setFollowCount] = useState<number>(followNumber || 0);
  const [isLoadingFollow, setIsLoadingFollow] = useState(false);

  // === Progress state (đọc tiếp)
  const [lastReadChapter, setLastReadChapter] = useState<number | null>(null);

  // ✅ NEW: ID an toàn cho mọi trường hợp (id | _id | chapters[0].mangaId)
  const mangaIdSafe = useMemo(
    () =>
      String(
        (manga as any)?.id ??
        (manga as any)?._id ??
        (chapters?.[0] as any)?.mangaId ??
        ""
      ),
    [manga, chapters]
  );

  const mangaHandle = useMemo(
    () => String((manga as any)?.slug || mangaIdSafe || ""),
    [manga, mangaIdSafe]
  );

  // Detect mobile (no hover) to prefer native <a> links which are more robust on iOS
  const isMobile =
    typeof window !== "undefined" && (window as any).matchMedia && (window as any).matchMedia("(hover: none)").matches;

  // Lấy chương mới nhất để dùng cho "Đọc Chap cuối"
  const latestChapterNumber =
    chapters && chapters.length
      ? Math.max(...chapters.map((c) => Number(c.chapterNumber) || 0))
      : 1;

  // ==== Tính chương để "Đọc tiếp" (không vượt quá chap mới nhất) ====
  const continueChapter =
    typeof lastReadChapter === "number" && lastReadChapter >= 1
      ? Math.min(lastReadChapter, latestChapterNumber)
      : null;
  // ==== END tính "Đọc tiếp" ====

  // text hiển thị giờ tương đối + tooltip giờ tuyệt đối
  const relativeUpdated = useMemo(() => getRelativeTimeNumeric(updatedAt), [updatedAt]);
  const absoluteUpdated = `${formatTime(updatedAt)} · ${formatDate(updatedAt)}`;

  const getStatusText = (status: number) => {
    switch (status) {
      case MANGA_USER_STATUS.ON_GOING:
        return "Đang tiến hành";
      case MANGA_USER_STATUS.COMPLETED:
        return "Đã hoàn thành";
      default:
        return "Đang tiến hành";
    }
  };

  const [copied, setCopied] = useState(false);
  const handleCopyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.toString());
      setCopied(true);
      toast.success("Đã sao chép mã truyện");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast.error("Không thể sao chép mã");
    }
  };

// ==== GET trạng thái + tiến độ đọc (gộp 1 request) ====
useEffect(() => {
  let canceled = false;

  const readLocal = () => {
    try {
      const raw = localStorage.getItem(`manga_progress_${mangaIdSafe}`);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      const n = obj?.chapterNumber == null ? null : Number(obj.chapterNumber);
      return typeof n === "number" && Number.isFinite(n) && n >= 1 ? n : null;
    } catch {
      return null;
    }
  };

  async function load() {
    if (!mangaIdSafe) {
      setIsFollowing(false);
      setLastReadChapter(null);
      return;
    }

    try {
      const res = await fetch(
        `/api/manga-status?mangaId=${encodeURIComponent(mangaIdSafe)}&includeProgress=1`,
        { credentials: "include", headers: { Accept: "application/json" } },
      );

      const json: any = await res.json().catch(() => null);
      if (canceled) return;

      if (res.ok) {
        setIsFollowing(Boolean(json?.isFollowing));
      }

      if (!res.ok || !json || json?.error) {
        setLastReadChapter(readLocal());
        return;
      }

      const raw = json?.chapterNumber;
      const n = raw == null ? null : Number(raw);
      const serverHasValid = Number.isFinite(n) && (n as number) >= 1;

      if (serverHasValid) {
        const finalN = n as number;
        setLastReadChapter(finalN);
        try {
          localStorage.setItem(
            `manga_progress_${mangaIdSafe}`,
            JSON.stringify({ chapterNumber: finalN, updatedAt: new Date().toISOString() }),
          );
        } catch {}
      } else {
        setLastReadChapter(readLocal());
      }
    } catch {
      if (!canceled) setLastReadChapter(readLocal());
    }
  }

  load();
  return () => {
    canceled = true;
  };
}, [mangaIdSafe]);
// ==== END GET trạng thái + tiến độ đọc ====


  const handleFollowToggle = async () => {
    const next = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/";
    if (!document.cookie.includes("__session=")) {
      window.location.href = `/login?redirectTo=${encodeURIComponent(next)}`;
      return;
    }

    if (isLoadingFollow) return;
    setIsLoadingFollow(true);

    const formData = new FormData();
    formData.append("intent", isFollowing ? "unfollow" : "follow");
    formData.append("mangaId", mangaIdSafe);

    try {
      const response = await fetch("/api/manga-follow", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setIsFollowing(data.isFollowing);
        setFollowCount((prev: number) => prev + (data.isFollowing ? 1 : -1));
        toast.success(data.message);
      } else {
        toast.error(data.error || "Có lỗi xảy ra");
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      toast.error("Có lỗi xảy ra khi xử lý yêu cầu");
    } finally {
      setIsLoadingFollow(false);
    }
  };

  const ratingChaptersWithVotes = Number((manga as any)?.ratingChaptersWithVotes ?? 0);
  const ratingTotalVotes = Number((manga as any)?.ratingTotalVotes ?? 0);
  const ratingScore = Number((manga as any)?.ratingScore ?? 0);

  const ratingDisplayText = useMemo(() => {
    if (ratingChaptersWithVotes < 3 || ratingTotalVotes < 5) return "0.0/0";
    return `${Number.isFinite(ratingScore) ? Math.max(0, Math.min(10, ratingScore)).toFixed(1) : "0.0"}/10`;
  }, [ratingChaptersWithVotes, ratingTotalVotes, ratingScore]);

  return (
    <div className="w-full">
      <div className="flex flex-col gap-10 lg:flex-row">
        {/* Ảnh bìa */}
        <div className="flex flex-shrink-0 items-center justify-center">
          <img
            src={poster}
            alt={`Bìa truyện ${title}`}
            className="h-96 w-64 rounded-lg object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>

        {/* Thông tin chi tiết */}
        <div className="flex w-full flex-col gap-4">
          {/* Tiêu đề (rating removed) */}
          <div className="flex flex-col gap-1.5">
            <h1 className="text-txt-primary text-2xl leading-snug font-semibold">
              {title}
            </h1>
            {alternateTitle ? (
              <div className="text-txt-secondary text-sm mt-1">{alternateTitle}</div>
            ) : null}
          </div>

          <div className="border-bd-default h-0 border-t" />

          {/* Thông tin chi tiết */}
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <div className="text-txt-secondary w-28 text-base font-medium">
              Tình trạng:
            </div>
            <div className="text-txt-primary text-base font-medium">
              {getStatusText(userStatus)}
            </div>

            {/* ❌ ĐÃ GỠ HÀNG “Người đăng” */}

            {/* AUTHORS: chỉ hiển thị khi có dữ liệu */}
            {authorItems.length > 0 && (
              <>
                <div className="text-txt-secondary w-28 text-base font-medium">Tác giả:</div>
                {/* BEGIN <feature> AUTHORS_CHIP_BRAND_TINT_NO_STRETCH */}
                <div className="flex flex-wrap gap-2 justify-self-start">
                  {authorItems.map(({ label: name, slug }) => {
                    if (isMobile) {
                      return (
                        <a
                          key={slug}
                          href={`/authors/${slug}`}
                          className={chipVariants.brandTint + " w-fit"}
                          title={name}
                          aria-label={`Xem tác giả ${name}`}
                        >
                          <span className="capitalize">{name}</span>
                        </a>
                      );
                    }
                    return (
                      <Link
                        key={slug}
                        to={`/authors/${slug}`}
                        className={chipVariants.brandTint + " w-fit"}
                        title={name}
                        aria-label={`Xem tác giả ${name}`}
                      >
                        <span className="capitalize">{name}</span>
                      <Link
                    );
                  })}
                {/* END <feature> AUTHORS_CHIP_BRAND_TINT_NO_STRETCH */}
              </>
            )}

            {/* Doujinshi */}
            {doujinshiNames.length > 0 && (
              <>
                <div className="text-txt-secondary w-28 text-base font-medium">Doujinshi:</div>
                <div className="flex flex-wrap gap-2 justify-self-start">
                  {doujinshiNames.map((name, i) => {
                    const slug = doujinshiSlugs[i] || toSlug(String(name));
                    return (
                      (isMobile ? (
                        <a key={`dj-${slug}-${i}`} href={`/doujinshi/${slug}`} className={chipVariants.outlineSubtle + " w-fit"} title={name} aria-label={`Xem doujinshi ${name}`}>
                          <span className="capitalize">{name}</span>
                        </a>
                      ) : (
                        <Link key={`dj-${slug}-${i}`} to={`/doujinshi/${slug}`} className={chipVariants.outlineSubtle + " w-fit"} title={name} aria-label={`Xem doujinshi ${name}`}>
                          <span className="capitalize">{name}</span>
                        <Link
                      ))
                    );
                </div>
              </>
            )}

            {/* Dịch giả (Translators) */}
            {translatorNames.length > 0 && (
              <>
                <div className="text-txt-secondary w-28 text-base font-medium">Dịch giả:</div>
                <div className="flex flex-wrap gap-2 justify-self-start">
                  {translatorNames.map((name, i) => {
                    const slug = translatorSlugs[i] || toSlug(String(name));
                    return (
                      (isMobile ? (
                        <a key={`tr-${slug}-${i}`} href={`/translators/${slug}`} className={chipVariants.outlineSubtle + " w-fit max-w-[286px]"} title={name} aria-label={`Xem dịch giả ${name}`}>
                          <span className="capitalize">{name}</span>
                        </a>
                      ) : (
                        <Link key={`tr-${slug}-${i}`} to={`/translators/${slug}`} className={chipVariants.outlineSubtle + " w-fit max-w-[286px]"} title={name} aria-label={`Xem dịch giả ${name}`}>
                          <span className="capitalize">{name}</span>
                        </Link>
                      ))
                    );
                  })}
                </div>
              </>
            )}

            {/* Nhân vật (Characters) */}
            {characterNames.length > 0 && (
              <>
                <div className="text-txt-secondary w-28 text-base font-medium">Nhân vật:</div>
                <CollapsibleCharacterChips names={characterNames} slugs={characterSlugs} isMobile={isMobile} />
              </>
            )}

            <div className="text-txt-secondary w-28 text-base font-medium">Cập nhật:</div>
            <div className="flex items-center gap-2">
              <time
                className="text-txt-primary text-base font-medium"
                title={absoluteUpdated}
                dateTime={new Date(updatedAt).toISOString()}
              >
                {relativeUpdated}
              </time>
            </div>

            <div className="text-txt-secondary w-28 text-base font-medium">Thể loại:</div>
            {/* BEGIN <feature> GENRES_CHIPS_COLLAPSIBLE_4ROWS */}
            <CollapsibleGenreChips genres={Array.isArray(genres) ? genres : []} maxRows={4} />
            {/* END <feature> GENRES_CHIPS_COLLAPSIBLE_4ROWS */}

            {/* ====== Hàng "Tổng quan" (label trái, stats phải) ====== */}
            <div className="text-txt-secondary w-28 text-base font-medium">
              Tổng quan:
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {/* 👁️ Lượt xem */}
              <span className="text-txt-secondary inline-flex items-center gap-1.5 text-sm" title="Lượt xem">
                <Eye className="h-4 w-4" />
                <span className="text-txt-primary font-medium">
                  {toDisplayView(viewNumber).toLocaleString("vi-VN")}
                </span>
              </span>
              {/* 🔖 Lượt theo dõi */}
              <span className="text-txt-secondary inline-flex items-center gap-1.5 text-sm" title="Người theo dõi">
                <Bookmark className="h-4 w-4" />
                <span className="text-txt-primary font-medium">
                  {(followCount ?? 0).toLocaleString("vi-VN")}
                </span>
              </span>
              {/* # Mã + nút "copy" chữ xám */}
              {code ? (
                <span className="text-txt-secondary inline-flex items-center gap-1.5 text-sm" title="Mã truyện">
                  <span className="text-txt-primary font-medium select-all">{code}</span>
                  <button
                    onClick={handleCopyCode}
                    className="cursor-pointer rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-txt-secondary transition-colors hover:bg-black/40 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D373FF]/30"
                    aria-label="Sao chép mã truyện"
                  >
                    {copied ? "đã sao chép" : "copy"}
                  </button>
                </span>
              ) : null}
              <span className="sr-only" aria-live="polite">
                {copied ? "Đã sao chép mã truyện" : ""}
              </span>
            </div>
          </div>

          {/* Buttons (ẩn nếu hideActions) */}
          {!hideActions && (
          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
            {/* Điểm truyện (thay cho "Yêu thích") */}
            <div
              className="border-lav-500 text-txt-focus flex items-center justify-center gap-1 rounded-lg border px-3 py-2"
              title="Điểm truyện (tính từ like/dislike theo từng chương)"
              aria-label={`Điểm truyện: ${ratingDisplayText}`}
            >
              <span className="text-sm font-semibold">{ratingDisplayText}</span>
            </div>

            {/* Theo dõi (compact, giữ text-sm) */}
            <button
              onClick={handleFollowToggle}
              disabled={isLoadingFollow}
              className={`border-lav-500 text-txt-focus hover:bg-lav-500/10 flex items-center justify-center gap-1 rounded-lg border px-3 py-2 transition-colors ${isLoadingFollow ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              aria-pressed={isFollowing}
              aria-label={isFollowing ? "Bỏ theo dõi" : "Theo dõi"}
            >
              {isFollowing ? (
                <BookmarkCheck className="h-4 w-4" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
              <span className="text-sm font-semibold">
                {isFollowing ? "Bỏ theo dõi" : "Theo dõi"}
              </span>
            </button>

            {/* ==== Nút Đọc tiếp (nếu có tiến độ) ==== */}
{continueChapter ? (
  <a
    href={(() => {
      const target = chapters.find((c) => Number((c as any).chapterNumber) === Number(continueChapter));
      const slug = String((target as any)?.slug || "").trim();
      return slug
        ? `/truyen-hentai/${mangaHandle}/${encodeURIComponent(slug)}`
        : `/truyen-hentai/${mangaHandle}`;
    })()}
    className="flex min-w-36 justify-center rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 text-black shadow-[0px_4px_8.9px_0px_rgba(196,69,255,0.25)] transition-transform hover:scale-105"
    aria-label={`Đọc tiếp (chương ${continueChapter})`}
    title={`Đang dở: Ch. ${continueChapter}${
      continueChapter < latestChapterNumber ? ` (có ${latestChapterNumber - continueChapter} chương mới)` : ""
    }`}
  >
    <span className="text-base font-semibold">Đọc tiếp</span>
  </a>
) : null}

            {/* ==== END Nút Đọc tiếp ==== */}

            {/* Đọc từ đầu (primary gradient, bằng kích thước với "Đọc Chap cuối") */}
            <a
              href={(() => {
                const target = chapters.find((c) => Number((c as any).chapterNumber) === 1);
                const slug = String((target as any)?.slug || "").trim();
                return slug
                  ? `/truyen-hentai/${mangaHandle}/${encodeURIComponent(slug)}`
                  : `/truyen-hentai/${mangaHandle}`;
              })()}
              className="flex min-w-36 justify-center rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 text-black shadow-[0px_4px_8.9px_0px_rgba(196,69,255,0.25)] transition-transform hover:scale-105"
              aria-label="Đọc từ đầu"
            >
              <span className="text-base font-semibold">Đọc từ đầu</span>
            </a>

            {/* luôn trỏ tới chương mới nhất — đổi nhãn thành "Đọc Chap cuối" */}
            <a
              href={(() => {
                const target = chapters.find((c) => Number((c as any).chapterNumber) === Number(latestChapterNumber));
                const slug = String((target as any)?.slug || "").trim();
                return slug
                  ? `/truyen-hentai/${mangaHandle}/${encodeURIComponent(slug)}`
                  : `/truyen-hentai/${mangaHandle}`;
              })()}
              className="flex min-w-36 justify-center rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 text-black shadow-[0px_4px_8.9px_0px_rgba(196,69,255,0.25)] transition-transform hover:scale-105"
              aria-label="Đọc mới nhất"
            >
              <span className="text-base font-semibold">Đọc mới nhất</span>
            </a>
          </div>
          )}
        </div>
      </div>

      {/* Phần nội dung mô tả */}
      {shouldShowDesc && (
        <div className="mt-8 flex flex-col gap-6" id="manga-description-section">
          <div className="border-bd-default flex items-center gap-3 border-b pb-3">
            <div className="relative h-[15px] w-[15px]">
              <img
                src="/images/icons/multi-star.svg"
                alt=""
                className="absolute top-0 left-[4.62px] h-4"
              />
            </div>
            {/* ✅ THÊM TIÊU ĐỀ CHO MÔ TẢ */}
            <h2 className="text-txt-primary text-xl font-semibold uppercase">
              GIỚI THIỆU
            </h2>
          </div>

          <div className="text-txt-primary text-base leading-normal font-medium">
            {safeDesc.split("\n").map((paragraph, index) => (
              <p key={index} className={index > 0 ? "mt-4" : ""}>
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Danh sách chapter (ẩn khi cần ở trang preview) */}
      {!hideChaptersList && (
      <div className="mt-8 flex flex-col gap-6">
        <div className="border-bd-default flex items-center gap-3 border-b pb-3">
          <div className="relative h-[15px] w-[15px]">
            <img
              src="/images/icons/multi-star.svg"
              alt=""
              className="absolute top-0 left-[4.62px] h-4"
            />
          </div>
          <h2 className="text-txt-primary text-xl font-semibold uppercase">
            DANH SÁCH CHƯƠNG
          </h2>
        </div>

        <div className="flex max-h-[304px] flex-col gap-2 overflow-y-auto rounded-lg md:max-h-[400px] lg:max-h-[492px]">
          {chapters.map((chapter) => {
            const chapterSlug = String((chapter as any)?.slug || "").trim();
            const href = chapterSlug
              ? `/truyen-hentai/${mangaHandle}/${encodeURIComponent(chapterSlug)}`
              : `/truyen-hentai/${mangaHandle}`;
            const commonClass =
              "bg-bgc-layer1 border-bd-default flex items-center justify-between rounded-xl border px-4 py-2 transition-colors hover:bg-white/5";

            const updatedAt = chapter.updatedAt ? new Date(chapter.updatedAt as any) : null;

            const content = (
              <>
                <span className="text-txt-primary text-base font-medium">
                  {getChapterDisplayName(chapter.title as any, chapter.chapterNumber as any)}
                </span>
                <div className="flex items-center gap-6">
                  <span className="text-txt-secondary flex items-center gap-1 text-sm">
                    <Eye className="h-4 w-4" />
                    {toDisplayView(chapter.viewNumber).toLocaleString("vi-VN")}
                  </span>
                  <time
                    className="text-txt-secondary text-sm"
                    title={updatedAt ? `${formatTime(updatedAt)} · ${formatDate(updatedAt)}` : ""}
                    dateTime={updatedAt ? updatedAt.toISOString() : undefined}
                  >
                    {updatedAt ? getRelativeTimeNumeric(updatedAt) : ""}
                  </time>
                </div>
              </>
            );

            // On mobile prefer native anchor to avoid timing/unmount issues on iOS.
            if (isMobile) {
              return (
                <a href={href} key={chapter.id} className={commonClass} aria-label={`Đọc chương ${chapter.chapterNumber}`}>
                  {content}
                </a>
              );
            }

            return (
              <Link to={href} key={chapter.id} className={commonClass}>
                {content}
              </Link>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}

export default MangaDetail;
