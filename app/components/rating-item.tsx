import { Link } from "react-router-dom";
import { isMobile } from "react-device-detect";
import { Eye, Heart } from "lucide-react";

import type { MangaType } from "~/database/models/manga.model";
import { buildMangaUrl } from "~/utils/manga-url.utils";

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
  const color =
    (index === 1 && "text-[#FFE133]") ||
    (index === 2 && "text-[#5BD8FA]") ||
    (index === 3 && "text-[#FF7158]") ||
    "text-txt-primary";
  const Wrapper: any = isMobile ? "a" : Link;
  const target = buildMangaUrl(manga);
  const linkProps = isMobile ? { href: target } : { to: target };

  return (
    <Wrapper {...linkProps} className="flex items-center gap-3 p-3">
      <span className={`w-5 text-center text-base font-semibold ${color}`}>{index}</span>
      <div
        className={
          usePortraitThumb
            ? "h-[84px] w-[56px] flex-shrink-0 overflow-hidden rounded-lg bg-black/20"
            : "h-14 w-14 flex-shrink-0 overflow-hidden rounded"
        }
      >
        <img
          src={manga.poster}
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
            <Heart className="text-txt-primary h-3 w-3" />
            <span className="text-txt-primary text-xs font-medium">
              {(manga.likeNumber ?? 0).toLocaleString("vi-VN")}
            </span>
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
