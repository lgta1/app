import { Link } from "react-router-dom";
import { isMobile } from "react-device-detect";
import { Eye } from "lucide-react";

import type { MangaType } from "~/database/models/manga.model";
import { buildMangaUrl } from "~/utils/manga-url.utils";
import { getPosterVariantForContext } from "~/utils/poster-variants.utils";

export default function RatingItem({
  manga,
  index,
  usePortraitThumb = false,
  latestChapterTitle,
}: {
  manga: MangaType;
  index: number;
  /** Nếu true: dùng thumbnail tỷ lệ 2:3 (56x84) thay vì vuông 56x56 */
  usePortraitThumb?: boolean;
  /** Tên chương mới nhất (tùy chọn) để hiển thị pill hoặc text theo quy tắc */
  latestChapterTitle?: string | null;
}) {
  const THUMB_UPSCALE = 1.2;
  const THUMB_SCALE = 1.4 * THUMB_UPSCALE;
  const BASE_SQUARE_PX = 56; // 14 * 4px
  const BASE_PORTRAIT_WIDTH_PX = 56;

  const squareSizePx = BASE_SQUARE_PX * THUMB_UPSCALE;
  const portraitWidthPx = BASE_PORTRAIT_WIDTH_PX * THUMB_SCALE;

  const color =
    (index === 1 && "text-[#FFE133]") ||
    (index === 2 && "text-[#5BD8FA]") ||
    (index === 3 && "text-[#FF7158]") ||
    "text-txt-primary";
  const Wrapper: any = isMobile ? "a" : Link;
  const target = buildMangaUrl(manga);
  const linkProps = isMobile ? { href: target } : { to: target };

  const ratingChaptersWithVotes = Number((manga as any)?.ratingChaptersWithVotes ?? 0);
  const ratingTotalVotes = Number((manga as any)?.ratingTotalVotes ?? 0);
  const ratingScore = Number((manga as any)?.ratingScore ?? 0);
  const ratingDisplay =
    ratingChaptersWithVotes < 3 || ratingTotalVotes < 5
      ? "0.0/0"
      : `${Math.max(0, Math.min(10, ratingScore)).toFixed(1)}/10`;

  return (
    <Wrapper {...linkProps} className="flex items-center gap-3 p-3">
      <span className={`w-5 text-center text-base font-semibold ${color}`}>{index}</span>
      <div
        className={[
          "flex-shrink-0 overflow-hidden bg-black/20",
          usePortraitThumb ? "rounded-lg aspect-[2/3]" : "rounded aspect-square",
        ].join(" ")}
        style={{ width: usePortraitThumb ? portraitWidthPx : squareSizePx }}
      >
        <img
          src={getPosterVariantForContext(manga, "leaderboard")?.url || manga.poster}
          alt={manga.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="flex-1 space-y-1">
        <h3 className="text-txt-primary line-clamp-1 text-base leading-6 font-semibold">
          {manga.title}
        </h3>
        <div className="flex items-center justify-start gap-4">
          <div className="flex items-center gap-1.5 backdrop-blur-md">
            <Eye className="text-txt-primary h-3 w-3" />
            <span className="text-txt-primary text-xs font-medium">
              {(manga.viewNumber ?? 0).toLocaleString("vi-VN")} lượt xem
            </span>
          </div>
          <div className="flex items-center gap-1.5 backdrop-blur-md">
            <span className="text-txt-primary text-xs font-medium">
              {ratingDisplay}
            </span>
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
