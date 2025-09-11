import { Link } from "react-router-dom";
import { ClockIcon } from "lucide-react";

import type { MangaType } from "~/database/models/manga.model";
import { formatDistanceToNow } from "~/utils/date.utils";

/** Lấy số chương linh hoạt từ nhiều field quen dùng */
function getChapterDisplay(manga: any): string | null {
  const cand =
    manga?.chapters ??
    manga?.lastChapterNumber ??
    manga?.lastChapter?.number ??
    manga?.lastChapter?.chapterNumber ??
    manga?.latestChapter?.number ??
    manga?.latestChapter?.chapterNumber;

  return typeof cand === "number" || typeof cand === "string" ? String(cand) : null;
}

export function TopBannerItem({
  manga,
  className,
}: {
  manga: MangaType;
  className?: string;
}) {
  const m: any = manga || {};
  const time = m.updatedAt ?? m.createdAt ?? m.publishedAt ?? null;
  const poster: string | undefined = m.poster || m.cover || m.thumbnail || m.image;
  const chapterText = getChapterDisplay(m);

  return (
    <>
      {/* Keyframes cho hiệu ứng “ánh sáng lướt” + “lấp lánh” + “hào quang thở” (nhẹ nhàng) */}
      <style>
        {`
          /* Ánh sáng lướt ngang (shimmer sweep) */
          @keyframes rr-shimmer {
            0%   { background-position: 0% 0%; }
            100% { background-position: 200% 0%; }
          }
          /* Hào quang thở (pulse glow) */
          @keyframes rr-pulse {
            0%, 100% { box-shadow: 0 0 0px rgba(255, 92, 143, 0.0), 0 0 0px rgba(168, 85, 247, 0.0); }
            50%      { box-shadow: 0 0 10px rgba(255, 92, 143, 0.35), 0 0 18px rgba(168, 85, 247, 0.25); }
          }
          /* Tia lấp lánh (twinkle) — vài đốm nhỏ chớp nhẹ */
          @keyframes rr-twinkle {
            0%, 100% { opacity: 0.15; transform: scale(0.9); }
            50%      { opacity: 0.95; transform: scale(1); }
          }
        `}
      </style>

      <Link key={manga.id} to={`/manga/${manga.id}`} className="flex-shrink-0">
        <div
          className={
            className
              ? `relative overflow-hidden rounded-lg ${className}`
              : "relative h-[270px] w-[180px] overflow-hidden rounded-lg"
          }
          style={{
            backgroundImage: poster ? `url(${poster})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* HOT badge: 1.3x + shimmer viền + pulse glow + tia lấp lánh */}
          <div className="absolute top-2 left-2 z-20">
            <div className="relative">
              {/* Viền shimmer: dải gradient lướt ngang chậm quanh badge */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-[2px] rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(240,171,252,0.00) 0%, rgba(240,171,252,0.85) 18%, rgba(251,113,133,0.95) 50%, rgba(240,171,252,0.85) 82%, rgba(240,171,252,0.00) 100%)",
                  backgroundSize: "200% 100%",
                  animation: "rr-shimmer 6s linear infinite",
                  filter: "blur(0.5px)",
                  mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), black 0)",
                  WebkitMask:
                    "radial-gradient(farthest-side, transparent calc(100% - 3px), black 0)",
                }}
              />
              {/* Nền badge + chữ (pulse glow dịu) */}
              <div
                className="flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-600 px-3.5 py-1.5 backdrop-blur-md"
                style={{ animation: "rr-pulse 3.6s ease-in-out infinite" }}
              >
                <span className="text-[0.975rem] leading-none font-bold text-white">
                  Hot
                </span>
              </div>

              {/* Tia lấp lánh (3 đốm nhỏ) */}
              <span
                className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-white/90"
                style={{ animation: "rr-twinkle 3s ease-in-out infinite" }}
                aria-hidden
              />
              <span
                className="absolute top-2 -left-0.5 h-1 w-1 rounded-full bg-white/85"
                style={{ animation: "rr-twinkle 3.6s ease-in-out 0.6s infinite" }}
                aria-hidden
              />
              <span
                className="absolute top-3 right-3 h-[3px] w-[3px] rounded-full bg-white/80"
                style={{ animation: "rr-twinkle 2.6s ease-in-out 0.3s infinite" }}
                aria-hidden
              />
            </div>
          </div>

          {/* Overlay 25% đáy: đen 0.85 -> 0.60 (yêu cầu) */}
          <div
            className="absolute right-0 bottom-0 left-0 z-10"
            style={{
              height: "25%",
              background:
                "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.60) 80%, rgba(0,0,0,0.00) 100%)",
            }}
          />

          {/* Nội dung đáy */}
          <div className="absolute bottom-0 left-0 z-20 w-full px-2 pb-3">
            <div className="flex flex-col gap-2">
              {/* TIÊU ĐỀ — đúng 1 dòng + ellipsis */}
              <h2 className="text-txt-primary truncate text-base font-semibold whitespace-nowrap">
                {m.title}
              </h2>

              <div className="flex items-center justify-between">
                {/* Tag CHƯƠNG (1.4x) */}
                <div className="bg-bgc-layer-semi-purple flex items-center justify-center rounded-full px-2.5 py-1.5 backdrop-blur-md">
                  <span className="text-txt-focus text-[14px] leading-none font-semibold">
                    {chapterText ? `Chương ${chapterText}` : "Chương ?"}
                  </span>
                </div>

                {/* Tag THỜI GIAN (1.3x) */}
                <div className="bg-bgc-layer-semi-neutral flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 backdrop-blur-md">
                  <ClockIcon className="text-txt-primary h-3.5 w-3.5" />
                  <span className="text-txt-primary text-[13px] leading-none font-medium">
                    {time ? formatDistanceToNow(time) : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {!poster && <div className="absolute inset-0 z-0 bg-neutral-800/40" />}
        </div>
      </Link>
    </>
  );
}

export default TopBannerItem;
