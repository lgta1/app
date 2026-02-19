import { Link } from "react-router-dom";
import { Eye } from "lucide-react";

import type { MangaType } from "~/database/models/manga.model";
import { formatDistanceToNow } from "~/utils/date.utils";
import { buildMangaUrl } from "~/utils/manga-url.utils";
import { toDisplayView } from "~/utils/display-view.utils";
import { getPosterVariantForContext } from "~/utils/poster-variants.utils";

interface LeaderboardTopMangaProps {
  topManga: MangaType[];
}

export function LeaderboardTopManga({ topManga }: LeaderboardTopMangaProps) {
  if (!topManga || topManga.length < 3) return null;

  const getScoreDisplay = (manga: any) => {
    const chaptersWithVotes = Number(manga?.ratingChaptersWithVotes ?? 0);
    const totalVotes = Number(manga?.ratingTotalVotes ?? 0);
    const score = Number(manga?.ratingScore ?? 0);
    if (chaptersWithVotes < 3 || totalVotes < 5) return "0.0/0";
    return `${Math.max(0, Math.min(10, score)).toFixed(1)}/10`;
  };

  const getPosterUrl = (manga: any) =>
    getPosterVariantForContext(manga, "leaderboard")?.url || manga?.poster;

  return (
    <>
      <div className="hidden w-full flex-row items-center justify-center gap-2 overflow-x-auto lg:flex">
        {/* #2 */}
        <Link
          to={buildMangaUrl(topManga[1])}
          className="relative m-8 flex flex-col items-center"
        >
          <div className="relative h-[360px] w-[248px] overflow-hidden rounded-lg shadow-[0px_0px_24px_0px_rgba(255,255,255,0.60)] outline-1 outline-offset-[-1px] outline-[#A3AFBA]">
            <img
              src={getPosterUrl(topManga[1])}
              alt={topManga[1]?.title}
              className="h-full w-full object-cover"
            />
            <div className="to-bgc-layer1 absolute inset-0 bg-gradient-to-b from-transparent from-40%"></div>
            <div className="absolute bottom-0 left-0 w-full px-2 py-4">
              <div className="flex flex-col gap-2">
                <h2 className="text-txt-primary line-clamp-2 text-base font-semibold [text-shadow:_0px_2px_4px_rgb(0_0_0_/_0.55)]">
                  {topManga[1]?.title}
                </h2>
                <div className="flex items-center justify-start gap-2">
                  <div className="bg-bgc-layer-semi-neutral flex items-center justify-center gap-1 rounded-full px-1.5 py-1 backdrop-blur-md">
                    <Eye className="text-txt-primary h-3 w-3" />
                    <span className="text-txt-primary line-clamp-1 text-[10px] font-medium">
                      {toDisplayView(topManga[1]?.viewNumber).toLocaleString("vi-VN")} lượt xem
                    </span>
                  </div>
                  <div className="bg-bgc-layer-semi-neutral flex items-center justify-center rounded-full px-1.5 py-1 backdrop-blur-md" title="Điểm truyện">
                    <span className="text-txt-primary line-clamp-1 text-[10px] font-medium">
                      {getScoreDisplay(topManga[1])}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute top-0 left-0 flex -translate-1/2 items-center justify-center">
            <img src="/images/leaderboard/2.svg" alt="Rank 2" className="h-14 w-auto" />
          </div>
        </Link>

        {/* #1 */}
        <Link
          to={buildMangaUrl(topManga[0])}
          className="relative m-8 flex flex-col items-center"
        >
          <div className="relative h-[366px] w-[250px] overflow-hidden rounded-lg shadow-[0px_0px_24px_0px_rgba(255,225,51,0.60)] outline-1 outline-offset-[-1px] outline-[#FFE133]">
            <img
              src={getPosterUrl(topManga[0])}
              alt={topManga[0]?.title}
              className="h-full w-full object-cover"
            />
            <div className="to-bgc-layer1 absolute inset-0 bg-gradient-to-b from-transparent from-40%"></div>
            <div className="absolute bottom-0 left-0 w-full px-2 py-4">
              <div className="flex flex-col gap-2">
                <h2 className="text-txt-primary line-clamp-2 text-base font-semibold [text-shadow:_0px_2px_4px_rgb(0_0_0_/_0.55)]">
                  {topManga[0]?.title}
                </h2>
                <div className="flex items-center justify-start gap-2">
                  <div className="bg-bgc-layer-semi-neutral flex items-center justify-center gap-1 rounded-full px-1.5 py-1 backdrop-blur-md">
                    <Eye className="text-txt-primary h-3 w-3" />
                    <span className="text-txt-primary line-clamp-1 text-[10px] font-medium">
                      {toDisplayView(topManga[0]?.viewNumber).toLocaleString("vi-VN")} lượt xem
                    </span>
                  </div>
                  <div className="bg-bgc-layer-semi-neutral flex items-center justify-center rounded-full px-1.5 py-1 backdrop-blur-md" title="Điểm truyện">
                    <span className="text-txt-primary line-clamp-1 text-[10px] font-medium">
                      {getScoreDisplay(topManga[0])}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute top-0 left-0 flex -translate-1/2 items-center justify-center">
            <img src="/images/leaderboard/1.svg" alt="Rank 1" className="h-14 w-auto" />
          </div>
        </Link>

        {/* #3 */}
        <Link
          to={buildMangaUrl(topManga[2])}
          className="relative m-8 flex flex-col items-center"
        >
          <div className="relative h-[366px] w-[248px] overflow-hidden rounded-lg shadow-[0px_0px_24px_0px_rgba(255,113,88,0.60)] outline-1 outline-offset-[-1px] outline-[#FF7158]">
            <img
              src={getPosterUrl(topManga[2])}
              alt={topManga[2]?.title}
              className="h-full w-full object-cover"
            />
            <div className="to-bgc-layer1 absolute inset-0 bg-gradient-to-b from-transparent from-40%"></div>
            <div className="absolute bottom-0 left-0 w-full px-2 py-4">
              <div className="flex flex-col gap-2">
                <h2 className="text-txt-primary line-clamp-2 text-base font-semibold [text-shadow:_0px_2px_4px_rgb(0_0_0_/_0.55)]">
                  {topManga[2]?.title}
                </h2>
                <div className="flex items-center justify-start gap-2">
                  <div className="bg-bgc-layer-semi-neutral flex items-center justify-center gap-1 rounded-full px-1.5 py-1 backdrop-blur-md">
                    <Eye className="text-txt-primary h-3 w-3" />
                    <span className="text-txt-primary line-clamp-1 text-[10px] font-medium">
                      {toDisplayView(topManga[2]?.viewNumber).toLocaleString("vi-VN")} lượt xem
                    </span>
                  </div>
                  <div className="bg-bgc-layer-semi-neutral flex items-center justify-center rounded-full px-1.5 py-1 backdrop-blur-md" title="Điểm truyện">
                    <span className="text-txt-primary line-clamp-1 text-[10px] font-medium">
                      {getScoreDisplay(topManga[2])}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute top-0 left-0 flex -translate-1/2 items-center justify-center">
            <img src="/images/leaderboard/3.svg" alt="Rank 3" className="h-14 w-auto" />
          </div>
        </Link>
      </div>

      <div className="flex w-full flex-col items-center justify-center gap-2 overflow-x-auto lg:hidden">
        {/* #1 */}
        <Link
          to={buildMangaUrl(topManga[0])}
          className="relative m-6 flex flex-col items-center"
        >
          <div className="relative h-[564px] w-[384px] overflow-hidden rounded-lg shadow-[0px_0px_24px_0px_rgba(255,225,51,0.60)] outline-1 outline-offset-[-1px] outline-[#FFE133]">
            <img
              src={getPosterUrl(topManga[0])}
              alt={topManga[0]?.title}
              className="h-full w-full object-cover"
            />
            <div className="to-bgc-layer1 absolute inset-0 bg-gradient-to-b from-transparent from-40%"></div>
            <div className="absolute bottom-0 left-0 w-full px-4 py-6">
              <div className="flex flex-col gap-2">
                <h2 className="text-txt-primary line-clamp-2 text-base font-semibold [text-shadow:_0px_2px_4px_rgb(0_0_0_/_0.55)]">
                  {topManga[0]?.title}
                </h2>
                <div className="flex items-center justify-start gap-2">
                  <div className="bg-bgc-layer-semi-neutral flex items-center justify-center gap-1 rounded-full px-1.5 py-1 backdrop-blur-md">
                    <Eye className="text-txt-primary h-3 w-3" />
                    <span className="text-txt-primary line-clamp-1 text-[10px] font-medium">
                      {toDisplayView(topManga[0]?.viewNumber).toLocaleString("vi-VN")} lượt xem
                    </span>
                  </div>
                  <div className="bg-bgc-layer-semi-neutral flex items-center justify-center rounded-full px-1.5 py-1 backdrop-blur-md" title="Điểm truyện">
                    <span className="text-txt-primary line-clamp-1 text-[10px] font-medium">
                      {getScoreDisplay(topManga[0])}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute top-5 left-5 flex items-center justify-center">
            <img src="/images/leaderboard/1.svg" alt="Rank 1" className="h-14 w-auto" />
          </div>
        </Link>

        {/* #2 */}
        <Link
          to={buildMangaUrl(topManga[1])}
          className="relative m-6 flex flex-col items-center"
        >
          <div className="relative h-[564px] w-[384px] overflow-hidden rounded-lg shadow-[0px_0px_24px_0px_rgba(255,255,255,0.60)] outline-1 outline-offset-[-1px] outline-[#A3AFBA]">
            <img
              src={getPosterUrl(topManga[1])}
              alt={topManga[1]?.title}
              className="h-full w-full object-cover"
            />
            <div className="to-bgc-layer1 absolute inset-0 bg-gradient-to-b from-transparent from-40%"></div>
            <div className="absolute bottom-0 left-0 w-full px-4 py-6">
              <div className="flex flex-col gap-2">
                <h2 className="text-txt-primary line-clamp-2 text-base font-semibold [text-shadow:_0px_2px_4px_rgb(0_0_0_/_0.55)]">
                  {topManga[1]?.title}
                </h2>
                <div className="flex items-center justify-start gap-2">
                  <div className="bg-bgc-layer-semi-neutral flex items-center justify-center gap-1 rounded-full px-1.5 py-1 backdrop-blur-md">
                    <Eye className="text-txt-primary h-3 w-3" />
                    <span className="text-txt-primary line-clamp-1 text-[10px] font-medium">
                      {toDisplayView(topManga[1]?.viewNumber).toLocaleString("vi-VN")} lượt xem
                    </span>
                  </div>
                  <div className="bg-bgc-layer-semi-neutral flex items-center justify-center rounded-full px-1.5 py-1 backdrop-blur-md" title="Điểm truyện">
                    <span className="text-txt-primary line-clamp-1 text-[10px] font-medium">
                      {getScoreDisplay(topManga[1])}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute top-5 left-5 flex items-center justify-center">
            <img src="/images/leaderboard/2.svg" alt="Rank 2" className="h-14 w-auto" />
          </div>
        </Link>

        {/* #3 */}
        <Link
          to={buildMangaUrl(topManga[2])}
          className="relative m-6 flex flex-col items-center"
        >
          <div className="relative h-[564px] w-[384px] overflow-hidden rounded-lg shadow-[0px_0px_24px_0px_rgba(255,113,88,0.60)] outline-1 outline-offset-[-1px] outline-[#FF7158]">
            <img
              src={getPosterUrl(topManga[2])}
              alt={topManga[2]?.title}
              className="h-full w-full object-cover"
            />
            <div className="to-bgc-layer1 absolute inset-0 bg-gradient-to-b from-transparent from-40%"></div>
            <div className="absolute bottom-0 left-0 w-full px-4 py-6">
              <div className="flex flex-col gap-2">
                <h2 className="text-txt-primary line-clamp-2 text-base font-semibold [text-shadow:_0px_2px_4px_rgb(0_0_0_/_0.55)]">
                  {topManga[2]?.title}
                </h2>
                <div className="flex items-center justify-start gap-2">
                  <div className="bg-bgc-layer-semi-neutral flex items-center justify-center gap-1 rounded-full px-1.5 py-1 backdrop-blur-md">
                    <Eye className="text-txt-primary h-3 w-3" />
                    <span className="text-txt-primary line-clamp-1 text-[10px] font-medium">
                      {toDisplayView(topManga[2]?.viewNumber).toLocaleString("vi-VN")} lượt xem
                    </span>
                  </div>
                  <div className="bg-bgc-layer-semi-neutral flex items-center justify-center rounded-full px-1.5 py-1 backdrop-blur-md" title="Điểm truyện">
                    <span className="text-txt-primary line-clamp-1 text-[10px] font-medium">
                      {getScoreDisplay(topManga[2])}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute top-5 left-5 flex items-center justify-center">
            <img src="/images/leaderboard/3.svg" alt="Rank 3" className="h-14 w-auto" />
          </div>
        </Link>
      </div>
    </>
  );
}

export default LeaderboardTopManga;
