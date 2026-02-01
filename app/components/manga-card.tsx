// app/components/manga-card.tsx
import { ShieldBan } from "lucide-react";
import { useMatches } from "react-router";

import type { MangaType } from "~/database/models/manga.model";
import { AppLink } from "~/components/app-link";
import { MANGA_USER_STATUS } from "~/constants/manga";
import { buildMangaUrl } from "~/utils/manga-url.utils";
import { DEFAULT_BLACKLIST_TAGS, normalizeBlacklistTag } from "~/constants/blacklist-tags";
import { useMediaQuery } from "~/hooks/use-media-query";
import { getPosterVariantForContext } from "~/utils/poster-variants.utils";

type Props = {
  manga: Pick<
    MangaType,
    | "id"
    | "title"
    | "poster"
    | "chapters"
    | "createdAt"
    | "updatedAt"
    | "genres"
    | "userStatus"
  > & {
    /** Tên chương mới nhất (optionally denormalized) */
    latestChapterTitle?: string | null;
  };
  /** Override latest chapter title (nếu truyền vào sẽ ưu tiên hơn manga.latestChapterTitle) */
  latestChapterTitle?: string | null;
  /**
   * variant:
   *  - default: dùng bình thường
   *  - bannerDesktop: desktop hot carousel (larger title + meta raised)
   */
  variant?: "default" | "bannerDesktop";
  className?: string;
  /** Thu nhỏ chữ (≈ -0.5 size) cho danh sách truyện mới */
  compact?: boolean;
  /** Tăng riêng kích thước title (≈ +0.5 size) khi dùng compact ở LatestUpdates */
  boostTitle?: boolean;
  /** Tùy chỉnh cách load ảnh poster để tránh double-lazy ở trang index */
  imgLoading?: "lazy" | "eager" | "auto";
  imgFetchPriority?: "high" | "low" | "auto";
  /** Ẩn gradient nền dưới (dưới phần ảnh và meta) để tránh flicker ở carousel mobile */
  hideBottomOverlay?: boolean;
  /** Make the <1h time badge stick to the top-right corner (only for LatestUpdates on index). */
  cornerTimeBadge?: boolean;
  /** Render the HOT badge attached to the top-left corner (only for banner items). */
  cornerHotBadge?: boolean;
};

export function MangaCard({
  manga,
  variant = "default",
  className,
  latestChapterTitle,
  compact = false,
  boostTitle = false,
  imgLoading = "lazy",
  imgFetchPriority = "high",
  hideBottomOverlay = false,
  cornerTimeBadge = false,
  cornerHotBadge = false,
}: Props) {
  const matches = useMatches();
  const rootData: any = matches.find((m) => m.id === "root")?.data;
  const isLoggedIn = Boolean(rootData?.user?.id);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const posterVariant = getPosterVariantForContext(manga, isDesktop ? "cardDesktop" : "cardMobile");

  const { id, title, poster, chapters, createdAt, updatedAt, genres, userStatus } = manga as any;
  const effectiveLatestTitle = (latestChapterTitle ?? (manga as any).latestChapterTitle ?? null) as string | null;

  // genres là slug string
  const genreSlugs: string[] = Array.isArray(genres)
    ? genres.map((g) => normalizeBlacklistTag(g))
    : [];

  // ONESHOT: nhận các biến thể slug phổ biến
  const isOneshot =
    genreSlugs.includes("oneshot") ||
    genreSlugs.includes("one-shot") ||
    genreSlugs.includes("one_shot");

  // COMPLETED: chỉ áp cho non-oneshot
  const isCompleted = !isOneshot && userStatus === MANGA_USER_STATUS.COMPLETED;

  // Thời gian: chỉ hiển thị nếu trong 1 giờ gần nhất, định dạng ngắn gọn vi: 36p trc
  const baseTime = updatedAt ?? createdAt;
  const isRecentWithin3h = (() => {
    if (!baseTime) return false;
    const t = new Date(baseTime as any).getTime();
    if (!Number.isFinite(t)) return false;
    return Date.now() - t <= 1 * 60 * 60 * 1000; // 1 giờ
  })();
  const timeLabel = (() => {
    if (!baseTime || !isRecentWithin3h) return undefined;
    const now = Date.now();
    const t = new Date(baseTime as any).getTime();
    if (!Number.isFinite(t)) return undefined;
    const diffMs = Math.max(0, now - t);
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin}p trc`;
    return undefined; // >=1h: không hiển thị
  })();

  const timeBadgeClassName = cornerTimeBadge
    ? "pointer-events-none absolute top-0 right-0 z-[4] select-none rounded-none rounded-bl-lg px-2 py-0.5 text-xs font-semibold text-white shadow-[0_1px_6px_rgba(0,0,0,0.55)]"
    : "pointer-events-none absolute top-2 right-2 z-[4] select-none rounded-full px-2 py-0.5 text-xs font-semibold text-white shadow-[0_1px_6px_rgba(0,0,0,0.55)]";

  const hotBadgeClassName =
    "pointer-events-none absolute top-0 left-0 z-[4] select-none rounded-none rounded-tl-xl rounded-br-lg px-2 py-0.5 text-sm font-semibold text-white shadow-[0_1px_6px_rgba(0,0,0,0.55)]";

  const isBannerDesktop = variant === "bannerDesktop";
  // Blacklist overlay:
  // - Logged-in: use root loader's user.blacklistTags (server authoritative), fallback to localStorage.
  // - Guest: always apply DEFAULT_BLACKLIST_TAGS, ignore localStorage.
  const isBlacklisted = (() => {
    try {
      const listFromRoot = rootData?.user?.blacklistTags;
      if (isLoggedIn && Array.isArray(listFromRoot)) {
        const set = new Set((listFromRoot as any[]).map((s) => normalizeBlacklistTag(s)).filter(Boolean));
        if (set.size === 0) return false;
        return genreSlugs.some((g) => set.has(g));
      }

      if (!isLoggedIn) {
        const set = new Set(DEFAULT_BLACKLIST_TAGS.map((s) => normalizeBlacklistTag(s)).filter(Boolean));
        if (set.size === 0) return false;
        return genreSlugs.some((g) => set.has(g));
      }

      // Logged-in fallback: localStorage (client-only)
      if (typeof window === "undefined") return false;
      const raw = window.localStorage.getItem("vh_blacklist_tags");
      if (!raw) return false;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || arr.length === 0) return false;
      const set = new Set((arr as any[]).map((s) => normalizeBlacklistTag(s)).filter(Boolean));
      if (set.size === 0) return false;
      return genreSlugs.some((g) => set.has(g));
    } catch {
      return false;
    }
  })();

  const mangaUrl = buildMangaUrl(manga as any);
  const linkTo = isBlacklisted && !isLoggedIn ? `/login?redirect=${encodeURIComponent(mangaUrl)}` : mangaUrl;
  return (
    <AppLink
      to={linkTo}
      className={[
        // add transform + scale on hover
        "group bg-bgc-layer1 relative block overflow-hidden rounded-xl border border-bd-default transition-colors transform transition-transform duration-200 ease-out will-change-transform",
        // Desktop-only hover scale (avoid iOS tap-to-hover swallowing the click)
        "vh-hover-scale-105",
        isBannerDesktop && "banner-desktop-card",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-variant={variant}
    >
      {/* Blacklist overlay covers entire card; pointer-events none keeps it clickable */}
      {isBlacklisted ? (
        <div
          className="pointer-events-none absolute inset-0 z-[50] flex flex-col items-center justify-center gap-2 px-4 text-center"
          style={{ backgroundColor: "rgba(0,0,0,0.92)" }}
        >
          <div className="text-white/85 text-sm font-semibold leading-snug">
            <div>Ảnh bị che do chứa thể loại bị ẩn</div>
            <div>Cài đặt thêm/bớt tại</div>
            <div className="mt-0.5 inline-flex items-center justify-center gap-1.5">
              <ShieldBan className="h-4 w-4 text-white/80" aria-hidden="true" />
              <span>Lọc thể loại</span>
            </div>
          </div>
        </div>
      ) : null}
      {/* CSS keyframes cho shimmer đỏ (gắn cục bộ trong component) */}
      <style
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `@keyframes shimmer-red { 0% { background-position: 0% 0; } 100% { background-position: 200% 0; } }`,
        }}
      />
      {/* Phương án 1: chỉ 1 ảnh thật bên trong overlay 3:4, nhưng khung tổng 2:3 để dành vùng meta phía dưới */}
      <div
        className="relative aspect-[2/3] w-full overflow-hidden bg-black"
        style={{ aspectRatio: "2 / 3" }}
      >
        {/* Overlay 3:4 hiển thị phần trên của poster */}
        <div
          className="absolute left-0 top-0 w-full overflow-hidden"
          style={{ aspectRatio: "3 / 4" }}
        >
          {cornerHotBadge ? (
            <span
              className={hotBadgeClassName}
              style={{
                backgroundImage:
                  "linear-gradient(100deg, rgba(244,63,94,0.35) 0%, rgba(244,63,94,0.95) 20%, rgba(244,63,94,0.35) 40%, rgba(244,63,94,0.95) 60%, rgba(244,63,94,0.35) 80%)",
                backgroundSize: "200% 100%",
                animation: "shimmer-red 4s linear infinite",
                border: "1px solid rgba(248,113,113,0.45)",
              }}
            >
              Hot
            </span>
          ) : null}
          <img
            src={posterVariant?.url || poster}
            alt={title}
            width={posterVariant?.width || 300}
            height={posterVariant?.height || 400}
            loading={imgLoading === "auto" ? undefined : imgLoading}
            decoding="async"
            fetchPriority={imgFetchPriority}
            className="block h-full w-full object-cover object-top select-none pointer-events-none"
          />
          {!hideBottomOverlay && (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[9%] z-[1] bg-gradient-to-t from-black/40 via-black/30 to-transparent/0"
            />
          )}
          {/* Thin lavender separator between image and meta; always kept on for carousel mobile */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-lav-500/30 z-[3]" />
          {/* Thời gian ở góc phải với shimmer đỏ chậm */}
          {timeLabel ? (
            <span
              className={timeBadgeClassName}
              style={{
                backgroundImage:
                  "linear-gradient(100deg, rgba(244,63,94,0.4) 0%, rgba(244,63,94,0.95) 20%, rgba(244,63,94,0.4) 40%, rgba(244,63,94,0.95) 60%, rgba(244,63,94,0.4) 80%)",
                backgroundSize: "200% 100%",
                animation: "shimmer-red 4s linear infinite",
                border: "1px solid rgba(248,113,113,0.45)",
              }}
              title={new Date(baseTime as any).toLocaleString()}
            >
              {timeLabel}
            </span>
          ) : null}
        </div>
      </div>

      {!hideBottomOverlay && (
        <div
          className="
            pointer-events-none absolute inset-x-[-10px] bottom-[-10px]
            h-[25%] min-h-[58px]
            bg-gradient-to-t from-[#0B0C1D]/95 via-[#0B0C1D]/90 to-transparent/0
            rounded-b-[5px]
            z-[1]
          "
        />
      )}

      {/* Nội dung: meta phía trên, title bên dưới (không thêm nền đen riêng) */}
  <div className="absolute inset-x-0 bottom-0 z-[2] min-w-0">
        {/* Meta */}
        <div
          className={[
            // Use baseline alignment and min-w-0 to let children truncate properly
            "flex items-center gap-2 px-2 pt-2 pb-1 text-xs text-white/90 min-w-0",
            "max-[415px]:text-[11px] max-[415px]:leading-[15px]",
            "max-[376px]:text-[10px] max-[376px]:leading-[14px]",
            isBannerDesktop && "-translate-y-[4px]",
          ].join(" ")}
        >
          {isOneshot ? (
            <span
              className={[
                "inline-flex h-6 items-center rounded-full border px-2 font-semibold",
                "max-[415px]:h-[22px] max-[415px]:px-[7px]",
                "max-[376px]:h-5 max-[376px]:px-[6px]",
                "bg-[#261343] text-[#DFA8FF]",
                "border-lav-500/45",
              ].join(" ")}
            >
              Oneshot
            </span>
          ) : null}

          {!isOneshot && (() => {
            // Raw chapter name, no pill, no cleaning. Fallback only when missing.
            const raw = effectiveLatestTitle ?? undefined;
            const label = raw && String(raw).trim().length > 0 ? String(raw) : `Chương ${Number(chapters ?? 0)}`;
            return (
              <span
                className={[
                  "text-white/90 font-semibold truncate flex-1 min-w-0 basis-auto text-outline",
                  compact
                    ? "text-[16px] leading-[20px] sm:text-[15px] sm:leading-[19px]"
                    : "text-[17px] leading-[21px] sm:text-base sm:leading-[20px]",
                  "max-[415px]:text-[14px] max-[415px]:leading-[18px]",
                  "max-[376px]:text-[13px] max-[376px]:leading-[17px]",
                ].join(" ")}
                title={label}
              >
                {label}
              </span>
            );
          })()}

          {isCompleted ? (
            <span
              className={[
                "ml-auto inline-flex h-6 items-center rounded-full border px-2 font-semibold",
                "max-[415px]:h-[22px] max-[415px]:px-[7px]",
                "max-[376px]:h-5 max-[376px]:px-[6px]",
                // Static END pill colors
                "bg-[#2A1216] text-[#D94545]",
                "border-red-500/45",
              ].join(" ")}
              title="Đã END"
            >
              END!
            </span>
          ) : null}
        </div>

        {/* Title: đẩy meta cao hơn bằng khoảng cách dưới meta */}
        <div className="px-2 pb-2">
          <h3
            className={[
              "mt-1.5 truncate font-semibold text-white",
              compact
                ? boostTitle
                  ? "text-[17px] leading-[21px] sm:text-base sm:leading-5" // boosted title size mobile +0.5
                  : "text-[16px] leading-[20px] sm:text-[15px] sm:leading-[19px]" // compact size mobile +0.5
                : "text-[17px] leading-[21px] sm:text-base sm:leading-5", // default mobile +0.5
              "max-[415px]:text-[17px] max-[415px]:leading-[19px]",
              "max-[376px]:text-[15px] max-[376px]:leading-[19px]",
              isBannerDesktop && "text-[18px] leading-[21px]",
            ]
              .filter(Boolean)
              .join(" ")}
            title={title}
          >
            {title}
          </h3>
        </div>
      </div>
    </AppLink>
  );
}
