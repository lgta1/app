// app/components/manga-card.tsx
import { Link } from "react-router-dom";

import type { MangaType } from "~/database/models/manga.model";
import { formatDistanceToNow } from "~/utils/date.utils";

/**
 * Card hiển thị manga trong lưới.
 * Giữ nguyên:
 * - named export: MangaCard
 * - payload field đang dùng (id, title, poster, chapters, createdAt, updatedAt, genres)
 * - logic thời gian (updatedAt ?? createdAt)
 * - logic Oneshot chỉ thay chữ "Chương N" -> "Oneshot"
 */

type Props = {
  manga: Pick<
    MangaType,
    "id" | "title" | "poster" | "chapters" | "createdAt" | "updatedAt" | "genres"
  >;
};

export function MangaCard({ manga }: Props) {
  const { id, title, poster, chapters, createdAt, updatedAt, genres } = manga;

  /* ===================== BEGIN <feature> ONESHOT_CARD_META ===================== */
  // Oneshot: chỉ đổi nhãn chương, vẫn giữ thời gian cập nhật
  const isOneshot =
    Array.isArray(genres) &&
    genres.some((g) => String(g).trim().toLowerCase() === "oneshot");

  const timeLabel =
    updatedAt || createdAt ? formatDistanceToNow(updatedAt ?? createdAt) : undefined;
  /* ====================== END <feature> ONESHOT_CARD_META ====================== */

  return (
    <Link
      to={`/manga/${id}`}
      prefetch="intent"
      className="group bg-bgc-layer1 relative block overflow-hidden rounded-xl border border-white/5 transition-colors hover:border-white/10"
    >
      {/* Ảnh */}
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        <img
          src={poster}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
      </div>

      {/* ===================== BEGIN <feature> BOTTOM_OVERLAY_30P ===================== */}
      {/* Overlay đáy ~30% chiều cao để làm nền cho tiêu đề + meta */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[25%] min-h-[72px] bg-gradient-to-t from-black/85 via-black/60 to-transparent backdrop-blur-[1px]" />

      {/* Nội dung phủ trên overlay (không bo góc tiêu đề) */}
      <div className="absolute inset-x-0 bottom-0 p-2">
        {/* Tiêu đề — 1 dòng, giữ font/cỡ như cũ */}
        <h3
          className="truncate text-sm leading-5 font-semibold text-white/95"
          title={title}
        >
          {title}
        </h3>

        {/* Meta: nhãn chương + thời gian (giữ nguyên cách hiển thị) */}
        <div className="mt-1.5 flex items-center gap-2 text-xs text-white/80">
          <span className="inline-flex h-6 items-center rounded-full border border-white/20 bg-white/[.14] px-2">
            {isOneshot ? "Oneshot" : `Chương ${Number(chapters ?? 0)}`}
          </span>

          {timeLabel ? <span className="mx-1.5 text-white/40">•</span> : null}
          {timeLabel ? <span className="truncate">{timeLabel}</span> : null}
        </div>
      </div>
      {/* ====================== END <feature> BOTTOM_OVERLAY_30P ====================== */}
    </Link>
  );
}
