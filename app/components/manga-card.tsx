// app/components/manga-card.tsx
import { Link } from "react-router-dom";

import type { MangaType } from "~/database/models/manga.model";
import { formatDistanceToNow } from "~/utils/date.utils";

type Props = {
  manga: Pick<
    MangaType,
    "id" | "title" | "poster" | "chapters" | "createdAt" | "updatedAt" | "genres"
  >;
};

export function MangaCard({ manga }: Props) {
  const { id, title, poster, chapters, createdAt, updatedAt, genres } = manga;

  const isOneshot =
    Array.isArray(genres) &&
    genres.some((g) => String(g).trim().toLowerCase() === "oneshot");

  const timeLabel =
    updatedAt || createdAt ? formatDistanceToNow(updatedAt ?? createdAt) : undefined;

  return (
    <Link
      to={`/manga/${id}`}
      prefetch="intent"
      className="group bg-bgc-layer1 relative block overflow-hidden rounded-xl border border-white/5 transition-colors hover:border-white/10"
    >
      {/* Ảnh nền 2:3 */}
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        <img
          src={poster}
          alt={title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Ảnh 3:4 phủ top – fill khung cha */}
      <div className="absolute inset-x-0 top-0 z-[1]">
        <div className="aspect-[3/4] overflow-hidden">
          <img
            src={poster}
            alt={title}
            className="w-full h-full object-cover pointer-events-none select-none"
            loading="lazy"
          />
         </div>
       </div>

      {/* Overlay gradient */}
      <div
        className="
          pointer-events-none absolute inset-x-0 bottom-0
          h-[17%] min-h-[50px]
          bg-gradient-to-t from-black/90 via-black/80 to-transparent
          backdrop-blur-[1.5px]
          z-[2]
        "
      />

      {/* Nội dung */}
      <div className="absolute inset-x-0 bottom-0 z-[2] p-2 pb-1">
        {/* Tiêu đề */}
        <h3
          className="
            truncate text-base leading-5 font-semibold text-white
            max-[415px]:text-[15.5px] max-[415px]:leading-[18px]
            max-[376px]:text-[14.5px] max-[376px]:leading-[18px]
          "
          title={title}
          style={{
            textShadow: `
              1px 0 2px rgba(0,0,0,0.9),
              -1px 0 2px rgba(0,0,0,0.9),
              0 1px 2px rgba(0,0,0,0.9),
              0 -1px 2px rgba(0,0,0,0.9)
            `,
          }}
        >
          {title}
        </h3>

        {/* Meta */}
        <div
          className="
            mt-1 flex items-center gap-2 text-xs text-white/90
            max-[415px]:text-[11px] max-[415px]:leading-[15px]
            max-[376px]:text-[10px] max-[376px]:leading-[14px]
          "
        >
          <span
            className="
              inline-flex h-6 items-center rounded-full border border-white/20 bg-white/15 px-2
              max-[415px]:h-[22px] max-[415px]:px-[7px]
              max-[376px]:h-5 max-[376px]:px-[6px]
            "
          >
            {isOneshot ? "Oneshot" : `Chương ${Number(chapters ?? 0)}`}
          </span>

          {timeLabel ? (
  <span className="truncate ml-auto mr-1.5 text-white/70">{timeLabel}</span>
) : null}

        </div>
      </div>
    </Link>
  );
}
