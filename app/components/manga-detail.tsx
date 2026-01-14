import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { Eye, Bookmark, BookmarkCheck, Info, Loader2, UploadCloud } from "lucide-react";

import { FEATURED_GENRE_PRIORITY_RANK, FEATURED_GENRE_SLUGS } from "~/constants/featured-genres";
import { MANGA_USER_STATUS } from "~/constants/manga";
import type { ChapterType } from "~/database/models/chapter.model";
import type { MangaType } from "~/database/models/manga.model";
import { formatDate, formatTime } from "~/utils/date.utils";
import { getChapterDisplayName } from "../utils/chapter.utils";
import { toSlug } from "~/utils/slug.utils"; // dùng để tạo slug

type DescriptionPart =
  | { type: "text"; value: string }
  | { type: "link"; href: string; label: string };

const URL_TRAILING_PUNCTUATION_RE = /[)\]}.>,!?;:]+$/;

function splitTrailingPunctuation(value: string) {
  const match = value.match(URL_TRAILING_PUNCTUATION_RE);
  if (!match) return { core: value, trailing: "" };
  const trailing = match[0];
  return { core: value.slice(0, -trailing.length), trailing };
}

function toHttpHref(candidate: string) {
  const raw = candidate.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function isAllowedDescriptionLink(href: string) {
  const hrefLower = href.toLowerCase();
  if (hrefLower.includes("vinahentai")) return true;

  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "fb.com" || host.endsWith(".fb.com")) return true;
    if (host === "discord.gg" || host.endsWith(".discord.gg")) return true;
    return false;
  } catch {
    return false;
  }
}

function getDescriptionParts(text: string): DescriptionPart[] {
  // Match URL-ish tokens without consuming whitespace. We only linkify after allowlist checks.
  const urlish = /\b((?:https?:\/\/|www\.)[^\s<]+|(?:fb\.com|discord\.gg)[^\s<]+|[^\s<]*vinahentai[^\s<]*)/gi;
  const parts: DescriptionPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(urlish)) {
    const value = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, index) });
    }

    const { core, trailing } = splitTrailingPunctuation(value);
    const href = toHttpHref(core);
    if (href && isAllowedDescriptionLink(href)) {
      parts.push({ type: "link", href, label: core });
      if (trailing) parts.push({ type: "text", value: trailing });
    } else {
      parts.push({ type: "text", value });
    }

    lastIndex = index + value.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }
  return parts;
}

interface MangaDetailProps {
  manga: MangaType;
  chapters: ChapterType[];
  /** Nếu chưa đăng nhập, không gọi các API yêu cầu session (tránh 401 spam). */
  isLoggedIn?: boolean;
  /** Ẩn toàn bộ nhóm nút hành động (theo dõi, thích, đọc, ...) cho trang preview quản lý */
  hideActions?: boolean;
  /** Ẩn phần danh sách chương (dùng cho trang preview quản lý) */
  hideChaptersList?: boolean;
  /** Bật vùng kéo-thả để đổi ảnh bìa (chỉ dùng cho trang preview quản lý) */
  posterDropEnabled?: boolean;
  /** Callback được gọi khi người dùng chọn / kéo 1 file ảnh mới */
  onPosterDrop?: (file: File) => void;
  /** Hiển thị trạng thái đang cập nhật ảnh bìa */
  posterDropUploading?: boolean;
  /** Gợi ý hiển thị bên dưới overlay kéo-thả */
  posterDropHint?: string;
  /** Bản đồ slug -> tên hiển thị (ưu tiên tiếng Việt) cho thể loại */
  genreDisplayMap?: Record<string, string>;
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
  "inline-flex items-center gap-2 rounded-full h-9 px-4 text-base whitespace-nowrap max-w-[220px] truncate select-none transition-[background,box-shadow,border,color] duration-150";

// Rectangle base (same size/colors behavior, only shape changes to rounded-md)
const chipRectBase =
  "inline-flex items-center gap-2 rounded-md h-9 px-4 text-base whitespace-nowrap max-w-[220px] truncate select-none transition-[background,box-shadow,border,color] duration-150";

const chipVariants = {
  /** Hoà nền: bề mặt tối + border subtle + text trắng 90% */
  surfaceBlend:
    `${chipBase} bg-black/25 border border-white/10 text-white/95 ` +
    `hover:bg-black/30 hover:border-white/15 ` +
    `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D373FF]/35`,

  /** Tím trong suốt: tạo điểm nhấn nhẹ cho "Tác giả" */
  brandTint:
    `${chipBase} bg-[rgba(211,115,255,.08)] border border-[rgba(211,115,255,.22)] text-[#EBD7FF] ` +
    `hover:bg-[rgba(211,115,255,.12)] hover:border-[rgba(211,115,255,.30)] ` +
    `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D373FF]/45`,

  /** Viền mờ: dành cho "Thể loại", không chiếm nổi bật */
  outlineSubtle:
    `${chipBase} bg-black/20 border border-white/12 text-[#EBD7FF]/95 hover:border-[#D373FF]/35 hover:bg-black/26 ` +
    `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D373FF]/30`,
};

// Rectangular variants: keep palette/size identical, only border-radius differs
const chipRectVariants = {
  brandTint:
    `${chipRectBase} bg-[rgba(211,115,255,.08)] border border-[rgba(211,115,255,.22)] text-[#EBD7FF] ` +
    `hover:bg-[rgba(211,115,255,.12)] hover:border-[rgba(211,115,255,.30)] ` +
    `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D373FF]/45`,
  outlineSubtle:
    `${chipRectBase} bg-black/20 border border-white/12 text-[#EBD7FF]/95 hover:border-[#D373FF]/35 hover:bg-black/26 ` +
    `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D373FF]/30`,
};
/* == Shared square tag style used for Genres, Doujinshi, Characters == */
const genreTagClass =
  "inline-flex items-center rounded-md border border-white/20 bg-black/20 px-3 py-1.5 text-sm leading-tight text-[#EBD7FF]/95 hover:border-[#D373FF]/35 hover:bg-black/26 transition-colors";
/* ====================== END <feature> CHIP_STYLES_SURFACE_BLEND ====================== */

const isPosterImageFile = (file?: File | null) => {
  if (!file) return false;
  if (file.type) return file.type.startsWith("image/");
  return /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name);
};

/* ===================== BEGIN <feature> GENRES_CHIPS_POPOVER (7 visible + popover) ===================== */
interface CollapsibleGenreChipsProps {
  genres: string[];
  /** Tùy chọn cũ: số hàng tối đa (không còn dùng trong logic mới theo count) */
  maxRows?: number;
  genreDisplayMap?: Record<string, string>;
}

interface GenreChipItem {
  label: string;
  slug: string;
  isFeatured: boolean;
}

function CollapsibleGenreChips({ genres, genreDisplayMap }: CollapsibleGenreChipsProps) {
  // Quy tắc mới:
  // - 1–10 thể loại: hiển thị tất cả, không có nút “+N”
  // - >=11 thể loại: hiển thị 8 thể loại đầu, phần còn lại đưa vào popover
  const list: GenreChipItem[] = (Array.isArray(genres) ? genres : []).map((name) => {
    const raw = String(name);
    const slug = toSlug(raw);
    const lookup = genreDisplayMap?.[slug.toLowerCase()];
    const label = lookup || raw;
    return { label, slug, isFeatured: FEATURED_GENRE_SLUGS.has(slug) };
  });
  const ordered = list.slice().sort((a, b) => {
    const aIsFeatured = a.isFeatured;
    const bIsFeatured = b.isFeatured;

    if (aIsFeatured && bIsFeatured) {
      const aRank = FEATURED_GENRE_PRIORITY_RANK[a.slug] ?? FEATURED_GENRE_PRIORITY_RANK[a.slug.replace(/-/g, "")] ?? Number.POSITIVE_INFINITY;
      const bRank = FEATURED_GENRE_PRIORITY_RANK[b.slug] ?? FEATURED_GENRE_PRIORITY_RANK[b.slug.replace(/-/g, "")] ?? Number.POSITIVE_INFINITY;
      if (aRank !== bRank) return aRank - bRank;
      return a.slug.localeCompare(b.slug);
    }

    if (aIsFeatured !== bIsFeatured) return aIsFeatured ? -1 : 1;

    // Non-featured: sort A–Z by slug
    return a.slug.localeCompare(b.slug);
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

  // Chip thể loại: dùng style vuông đồng bộ với các tag khác

  return (
    <div className="relative justify-self-start">
      <div className="flex flex-wrap gap-2">
        {visible.map((g, idx) => {
          const { label, slug } = g;
          return (
            <Link
              key={`${slug}-${idx}`}
              to={`/genres/${slug}`}
              prefetch="intent"
              className={genreTagClass + " w-fit"}
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
              className={genreTagClass + " w-fit text-txt-primary"}
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
          className="absolute right-0 z-20 mt-2 w-[min(92vw,360px)] rounded-xl border border-white/10 bg-black/80 p-3 shadow-xl backdrop-blur-md md:w-[min(80vw,360px)]"
        >
          <div className="flex flex-wrap gap-2 max-h-[240px] overflow-auto">
            {rest.map((g, idx) => {
              const { label, slug } = g;
              return (
                <Link
                  key={`${slug}-rest-${idx}`}
                  to={`/genres/${slug}`}
                  prefetch="intent"
                  className={genreTagClass + " w-fit"}
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

  const renderChip = (key: string, item: { label: string; slug: string }) => {
    if (isMobile) {
      return (
        <a
          key={key}
          href={`/characters/${item.slug}`}
          className={genreTagClass + " w-fit"}
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
        className={genreTagClass + " w-fit"}
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
              className={genreTagClass + " w-fit text-txt-primary"}
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
          className="absolute right-0 z-20 mt-2 w-[min(92vw,360px)] rounded-xl border border-white/10 bg-black/80 p-3 shadow-xl backdrop-blur-md md:w-[min(80vw,360px)]"
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

export function MangaDetail({
  manga,
  chapters,
  isLoggedIn = false,
  hideActions,
  hideChaptersList,
  posterDropEnabled = false,
  onPosterDrop,
  posterDropUploading = false,
  posterDropHint,
  genreDisplayMap = {},
}: MangaDetailProps) {
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
  // Tác giả:
  // - Canonical: authorNames/authorSlugs được lưu trong DB (giữ đúng slug, kể cả CJK + collision -2)
  // - Legacy: fallback từ chuỗi manga.author = "Tên1, Tên2"
  const authorItems = useMemo(() => {
    const names = Array.isArray((manga as any)?.authorNames)
      ? ((manga as any).authorNames as string[])
      : [];
    const slugs = Array.isArray((manga as any)?.authorSlugs)
      ? ((manga as any).authorSlugs as string[])
      : [];
    const authorMangaCountBySlug = ((manga as any)?.authorMangaCountBySlug ?? {}) as Record<string, number>;

    if (names.length > 0) {
      return names
        .map((name, idx) => {
          const label = String(name || "").trim();
          if (!label) return null;
          const slug = String(slugs[idx] || toSlug(label));
          const count = typeof authorMangaCountBySlug[String(slug).toLowerCase()] === "number"
            ? authorMangaCountBySlug[String(slug).toLowerCase()]
            : undefined;
          return { label, slug, count };
        })
        .filter(Boolean) as Array<{ label: string; slug: string }>;
    }

    return String(author || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
        .map((label) => ({ label, slug: toSlug(label), count: undefined }));
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

  const renderedDesc = useMemo(() => {
    if (!safeDesc) return [] as Array<string | ReactNode>;
    const parts = getDescriptionParts(safeDesc);
    return parts.map((p, idx) => {
      if (p.type === "text") return p.value;
      return (
        <a
          key={`desc-link-${idx}`}
          href={p.href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-txt-focus no-underline font-medium hover:opacity-90"
        >
          {p.label}
        </a>
      );
    });
  }, [safeDesc]);

  // === Giới hạn mô tả theo "dòng" nhập (newline) ===
  // - <= 7 dòng: hiển thị tất cả
  // - >= 8 dòng: chỉ hiển thị 5 dòng + nút "Xem thêm"
  const descLineCount = useMemo(() => {
    const raw = String(safeDesc || "").replace(/\r\n/g, "\n");
    const lines = raw
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return lines.length;
  }, [safeDesc]);

  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const descHasMore = descLineCount >= 8;
  const descClampLines = !isDescExpanded && descHasMore ? 5 : undefined;

  // === Gợi ý còn chương phía dưới (scroll hint) ===
  const chaptersListRef = useRef<HTMLDivElement | null>(null);
  const [chaptersHasMoreBelow, setChaptersHasMoreBelow] = useState(false);

  useEffect(() => {
    if (hideChaptersList) return;
    const el = chaptersListRef.current;
    if (!el) return;

    const update = () => {
      const canScroll = el.scrollHeight > el.clientHeight + 1;
      const hasMore = canScroll && el.scrollTop + el.clientHeight < el.scrollHeight - 1;
      setChaptersHasMoreBelow(hasMore);
    };

    const onScroll = () => update();
    const onResize = () => update();

    // đo sau khi layout ổn định
    requestAnimationFrame(update);
    el.addEventListener("scroll", onScroll, { passive: true } as any);
    window.addEventListener("resize", onResize);

    return () => {
      el.removeEventListener("scroll", onScroll as any);
      window.removeEventListener("resize", onResize);
    };
  }, [hideChaptersList, chapters]);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followCount, setFollowCount] = useState<number>(followNumber || 0);
  const [isLoadingFollow, setIsLoadingFollow] = useState(false);

  const canDropPoster = posterDropEnabled && typeof onPosterDrop === "function";
  const posterHintMessage = posterDropHint || "Thả ảnh để cập nhật";

  const triggerPosterUpload = (file?: File | null) => {
    if (!canDropPoster || !file) return;
    if (!isPosterImageFile(file)) {
      toast.error("Vui lòng chọn file ảnh hợp lệ");
      return;
    }
    onPosterDrop?.(file);
  };

  const handlePosterInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] || null;
    triggerPosterUpload(file);
    event.currentTarget.value = "";
  };

  const handlePosterDropEvent = (event: DragEvent<HTMLDivElement>) => {
    if (!canDropPoster) return;
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0] || null;
    setIsPosterDragOver(false);
    if (!file) {
      toast.error("Không tìm thấy file ảnh");
      return;
    }
    if (!isPosterImageFile(file)) {
      toast.error("File không phải ảnh");
      return;
    }
    onPosterDrop?.(file);
  };

  const handlePosterDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!canDropPoster) return;
    event.preventDefault();
    if (!isPosterDragOver) setIsPosterDragOver(true);
  };

  const handlePosterDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!canDropPoster) return;
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setIsPosterDragOver(false);
  };

  // ⭐ Rating system removed – states deleted
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

  const posterFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPosterDragOver, setIsPosterDragOver] = useState(false);

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

  useEffect(() => {
    const checkFollowStatus = async () => {
      try {
        const response = await fetch(`/api/manga-follow?mangaId=${mangaIdSafe}`);
        const data = await response.json();
        if (response.ok) setIsFollowing(data.isFollowing);
      } catch (error) {
        console.error("Error checking follow status:", error);
      }
    };

    if (mangaIdSafe) {
      checkFollowStatus();
    }
  }, [mangaIdSafe]);

// ==== GET tiến độ đọc (yêu cầu đã đăng nhập) ====
useEffect(() => {
  let canceled = false;

  // helper đọc local fallback
  const readLocal = () => {
    try {
      const raw = localStorage.getItem(`manga_progress_${mangaIdSafe}`);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      const rawChap = obj?.chapterNumber;
      if (typeof rawChap === 'number' && Number.isFinite(rawChap) && rawChap >= 1) {
        return rawChap;
      }
      if (typeof rawChap === 'string') {
        const parsed = Number(rawChap);
        return Number.isFinite(parsed) && parsed >= 1 ? parsed : null;
      }
      return null;
    } catch {
      return null;
    }
  };

  async function load() {
    if (!mangaIdSafe) {
      setLastReadChapter(null);
      return;
    }

    // Khi chưa đăng nhập (hoặc trang preview ẩn actions), chỉ dùng localStorage.
    // Tránh gọi /api/manga-progress gây 401 và tốn CPU.
    if (!isLoggedIn || hideActions) {
      const nLocal = readLocal();
      if (!canceled) setLastReadChapter(nLocal);
      return;
    }

    try {
      const res = await fetch(
        `/api/manga-progress?mangaId=${encodeURIComponent(mangaIdSafe)}`,
        { credentials: "include", headers: { Accept: "application/json" } }
      );

      // Server không OK → thử local
      if (!res.ok) {
        const nLocal = readLocal();
        if (!canceled) setLastReadChapter(nLocal);
        return;
      }

      // Dùng tên biến khác "json" để tránh đụng "data" ở scope khác
      const json: any = await res.json().catch(() => null);
      if (canceled) return;

      // 200 nhưng body lỗi → thử local
      if (!json || json?.error) {
        const nLocal = readLocal();
        if (!canceled) setLastReadChapter(nLocal);
        return;
      }

      // 200 OK nhưng chapterNumber thiếu/không hợp lệ → thử local
      const raw = json?.chapterNumber;
      const n = raw == null ? null : Number(raw);
      const serverHasValid = Number.isFinite(n) && (n as number) >= 1;

      if (serverHasValid) {
        const finalN = n as number;
        if (!canceled) setLastReadChapter(finalN);
        // Đồng bộ local để lần sau
        try {
          localStorage.setItem(
            `manga_progress_${mangaIdSafe}`,
            JSON.stringify({ chapterNumber: finalN, updatedAt: new Date().toISOString() })
          );
        } catch {}
      } else {
        const nLocal = readLocal();
        if (!canceled) setLastReadChapter(nLocal);
      }
    } catch {
      // Lỗi mạng → fallback local
      const nLocal = readLocal();
      if (!canceled) setLastReadChapter(nLocal);
    }
  }

  load();
  return () => {
    canceled = true;
  };
}, [mangaIdSafe, isLoggedIn, hideActions]);
// ==== END GET tiến độ đọc ====


  const handleFollowToggle = async () => {
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

  // Rating feature removed – handler deleted

  const ratingChaptersWithVotes = Math.max(0, Number((manga as any)?.ratingChaptersWithVotes) || 0);
  const ratingTotalVotes = Math.max(0, Number((manga as any)?.ratingTotalVotes) || 0);
  const ratingScore = Math.max(0, Math.min(10, Number((manga as any)?.ratingScore) || 0));
  const ratingDisplay = useMemo(() => {
    if (ratingChaptersWithVotes < 3 || ratingTotalVotes < 5) return "0.0/0";
    return `${ratingScore.toFixed(1)}/10`;
  }, [ratingChaptersWithVotes, ratingTotalVotes, ratingScore]);

  return (
    <div className="w-full">
      <div className="flex flex-col gap-10 portrait:gap-6 sm:portrait:gap-10 lg:flex-row">
        {/* Ảnh bìa */}
        <div
          className={`relative flex flex-shrink-0 items-center justify-center ${
            canDropPoster ? "group cursor-copy" : ""
          }`}
          onDrop={canDropPoster ? handlePosterDropEvent : undefined}
          onDragOver={canDropPoster ? handlePosterDragOver : undefined}
          onDragLeave={canDropPoster ? handlePosterDragLeave : undefined}
        >
          <img
            src={poster}
            alt={`Bìa truyện ${title}`}
            width={256}
            height={384}
            className="h-96 w-64 portrait:w-72 sm:portrait:w-64 rounded-lg object-cover"
            loading="lazy"
            decoding="async"
          />

          {canDropPoster ? (
            <>
              <input
                ref={posterFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePosterInputChange}
                disabled={posterDropUploading}
              />
              <div
                className={`pointer-events-none absolute inset-0 rounded-lg border-2 border-dashed transition ${
                  isPosterDragOver
                    ? "border-[#D373FF] bg-black/30"
                    : "border-transparent bg-transparent group-hover:border-white/20"
                }`}
              />
              <div
                className={`pointer-events-none absolute inset-0 z-10 rounded-lg bg-black/60 text-center text-sm text-white transition ${
                  posterDropUploading || isPosterDragOver ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <div className="flex h-full flex-col items-center justify-center gap-2 px-4">
                  {posterDropUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[#D373FF]" />
                  ) : (
                    <UploadCloud className="h-5 w-5 text-[#D373FF]" />
                  )}
                  <p className="text-sm font-semibold">Thả ảnh để cập nhật</p>
                  {posterHintMessage ? (
                    <p className="text-xs text-white/70">{posterHintMessage}</p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => posterFileInputRef.current?.click()}
                disabled={posterDropUploading}
                className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/30 bg-black/70 px-4 py-1 text-xs font-semibold text-white shadow-lg transition hover:border-[#D373FF] hover:text-[#D373FF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {posterDropUploading ? "Đang cập nhật…" : "Đổi ảnh"}
              </button>
            </>
          ) : null}
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
          <div className="grid grid-cols-[auto_1fr] gap-y-3 gap-x-[0.6rem] md:gap-x-[0.45rem]">
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
                {/* BEGIN <feature> AUTHORS_CHIP_RECT_BRAND_TINT */}
                <div className="flex flex-wrap gap-2 justify-self-start">
                  {authorItems.map(({ label: name, slug, count }: any) => {
                    const countDisplay = typeof count === "number" ? Math.max(0, count) : null;
                    if (isMobile) {
                      return (
                        <a
                          key={slug}
                          href={`/authors/${slug}`}
                          className="group inline-flex h-9 max-w-[260px] items-stretch overflow-hidden rounded-md border border-[rgba(211,115,255,.22)] text-[#EBD7FF]"
                          title={name}
                          aria-label={`Xem tác giả ${name}`}
                        >
                          <span className="flex min-w-0 items-center bg-[rgba(211,115,255,.08)] px-4 group-hover:bg-[rgba(211,115,255,.12)]">
                            <span className="truncate capitalize text-base">{name}</span>
                          </span>
                          {countDisplay !== null ? (
                            <span className="flex items-center bg-[rgba(211,115,255,.14)] px-2.5 text-sm font-semibold tabular-nums text-[#EBD7FF]/95 group-hover:bg-[rgba(211,115,255,.18)]">
                              {countDisplay}
                            </span>
                          ) : null}
                        </a>
                      );
                    }
                    return (
                      <Link
                        key={slug}
                        to={`/authors/${slug}`}
                        className="group inline-flex h-9 max-w-[260px] items-stretch overflow-hidden rounded-md border border-[rgba(211,115,255,.22)] text-[#EBD7FF]"
                        title={name}
                        aria-label={`Xem tác giả ${name}`}
                      >
                        <span className="flex min-w-0 items-center bg-[rgba(211,115,255,.08)] px-4 group-hover:bg-[rgba(211,115,255,.12)]">
                          <span className="truncate capitalize text-base">{name}</span>
                        </span>
                        {countDisplay !== null ? (
                          <span className="flex items-center bg-[rgba(211,115,255,.14)] px-2.5 text-sm font-semibold tabular-nums text-[#EBD7FF]/95 group-hover:bg-[rgba(211,115,255,.18)]">
                            {countDisplay}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
                {/* END <feature> AUTHORS_CHIP_RECT_BRAND_TINT */}
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
                        <a key={`tr-${slug}-${i}`} href={`/translators/${slug}`} className={chipRectVariants.outlineSubtle + " w-fit"} title={name} aria-label={`Xem dịch giả ${name}`}>
                          <span className="capitalize">{name}</span>
                        </a>
                      ) : (
                        <Link key={`tr-${slug}-${i}`} to={`/translators/${slug}`} className={chipRectVariants.outlineSubtle + " w-fit"} title={name} aria-label={`Xem dịch giả ${name}`}>
                          <span className="capitalize">{name}</span>
                        </Link>
                      ))
                    );
                  })}
                </div>
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
                        <a key={`dj-${slug}-${i}`} href={`/doujinshi/${slug}`} className={genreTagClass + " w-fit"} title={name} aria-label={`Xem doujinshi ${name}`}>
                          <span className="capitalize">{name}</span>
                        </a>
                      ) : (
                        <Link key={`dj-${slug}-${i}`} to={`/doujinshi/${slug}`} className={genreTagClass + " w-fit"} title={name} aria-label={`Xem doujinshi ${name}`}>
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
            <CollapsibleGenreChips
              genres={Array.isArray(genres) ? genres : []}
              maxRows={4}
              genreDisplayMap={genreDisplayMap}
            />
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
                  {(viewNumber ?? 0).toLocaleString("vi-VN")}
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
                </span>
              ) : null}
            </div>
          </div>

          {/* Buttons (ẩn nếu hideActions) */}
          {!hideActions && (
          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
            {/* Điểm truyện (tổng hợp từ đánh giá các chương) */}
            <div
              className="border-lav-500 text-txt-focus flex items-center justify-center gap-1 rounded-lg border px-3 py-2"
              aria-label="Điểm truyện"
              title="Dựa trên đánh giá từ các chương"
            >
              <span className="text-sm font-semibold">{ratingDisplay}</span>
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
        <div className="mt-8 flex flex-col gap-[0.8rem]" id="manga-description-section">
          <div className="flex items-center gap-3">
            {/* Icon trước tiêu đề đã được yêu cầu xoá */}
            <h2 className="text-txt-primary text-xl font-semibold uppercase">GIỚI THIỆU</h2>
          </div>

          <div className="relative">
            <div
              className="text-txt-secondary text-base font-medium leading-[1.25] whitespace-pre-line"
              style={
                descClampLines
                  ? ({
                      display: "-webkit-box",
                      WebkitLineClamp: descClampLines,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    } as any)
                  : undefined
              }
            >
              {renderedDesc}
            </div>

            {!isDescExpanded && descHasMore ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-bgc-layer1" />
            ) : null}
          </div>

          {!isDescExpanded && descHasMore ? (
            <button
              type="button"
              onClick={() => setIsDescExpanded(true)}
              className="text-txt-secondary w-fit text-sm font-medium underline underline-offset-4 hover:text-txt-primary"
              aria-label="Xem thêm mô tả"
            >
              Xem thêm
            </button>
          ) : null}
        </div>
      )}

      {/* Danh sách chapter (ẩn khi cần ở trang preview) */}
      {!hideChaptersList && (
      <div className="mt-8 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-lav-500"><line x1="8" x2="21" y1="6" y2="6"></line><line x1="8" x2="21" y1="12" y2="12"></line><line x1="8" x2="21" y1="18" y2="18"></line><path d="M3 6h.01"></path><path d="M3 12h.01"></path><path d="M3 18h.01"></path></svg>
          <h2 className="text-txt-primary text-xl font-semibold uppercase">
            DANH SÁCH CHƯƠNG
          </h2>
        </div>

        <div className="relative">
          <div
            ref={chaptersListRef}
            className="flex max-h-[304px] flex-col overflow-y-auto rounded-md border border-bd-default bg-bgc-layer1 divide-y divide-bd-default md:max-h-[400px] lg:max-h-[492px]"
          >
            {chapters.map((chapter) => {
            const chapterSlug = String((chapter as any)?.slug || "").trim();
            const href = chapterSlug
              ? `/truyen-hentai/${mangaHandle}/${encodeURIComponent(chapterSlug)}`
              : `/truyen-hentai/${mangaHandle}`;
            const commonClass =
              "block w-full px-4 py-2 transition-colors hover:bg-white/5";

            const titleClamp2 = {
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            } as any;

            const content = (
              <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                <span className="text-txt-primary min-w-0 text-base font-medium" style={titleClamp2}>
                  {getChapterDisplayName(chapter.title as any, chapter.chapterNumber as any)}
                </span>

                <div className="grid grid-cols-[auto_auto] items-start justify-end gap-x-6 text-right">
                  <span className="text-txt-secondary flex items-center justify-end gap-1 text-sm whitespace-nowrap">
                    <Eye className="h-4 w-4" />
                    {(chapter.viewNumber ?? 0).toLocaleString("vi-VN")}
                  </span>
                  <time
                    className="text-txt-secondary text-sm whitespace-nowrap"
                    title={`${formatTime(chapter.createdAt)} · ${formatDate(chapter.createdAt)}`}
                    dateTime={new Date(chapter.createdAt).toISOString()}
                  >
                    {getRelativeTimeNumeric(chapter.createdAt)}
                  </time>
                </div>
              </div>
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

          {chaptersHasMoreBelow ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-bgc-layer1" />
          ) : null}
        </div>
      </div>
      )}
    </div>
  );
}

export default MangaDetail;
