import { type MetaFunction, NavLink } from "react-router-dom";

import LeaderboardUserWaifuItem from "~/components/leaderboard-user-waifu-item";
import type { UserWaifuLeaderboardType } from "~/database/models/user-waifu-leaderboard.model";
import { usePagination } from "~/hooks/use-pagination";

export const meta: MetaFunction = () => {
  return [
    { title: "Bảng xếp hạng Harem | VinaHentai" },
    {
      name: "description",
      content: "Xem bảng xếp hạng Harem tại VinaHentai",
    },
  ];
};

export default function LeaderboardWaifu() {
  const {
    data: leaderboardData,
    isLoading,
    error,
  } = usePagination<UserWaifuLeaderboardType>({
    apiUrl: "/api/waifu/leaderboard",
    limit: 100,
  });

  return (
    <div className="container-page flex flex-col items-center justify-center gap-11 px-4 py-8 md:px-6 lg:px-0">
      {/* Tab buttons */}
      <div className="flex items-center justify-start gap-2 sm:gap-4">
        <NavLink
          to="/leaderboard/manga"
          className={({ isActive }) =>
            `${isActive ? "bg-btn-primary text-txt-inverse" : "bg-bgc-layer-semi-neutral text-txt-primary"} rounded-[32px] px-3 py-1.5 text-center text-xs leading-normal font-medium backdrop-blur-[3.4px] sm:text-base`
          }
        >
          Top Truyện hentai
        </NavLink>
        <NavLink
          to="/leaderboard/member"
          className={({ isActive }) =>
            `${isActive ? "bg-btn-primary text-txt-inverse" : "bg-bgc-layer-semi-neutral text-txt-primary"} rounded-[32px] px-3 py-1.5 text-center text-xs leading-normal font-medium backdrop-blur-[3.4px] sm:text-base`
          }
        >
          Thánh Lọ Bảng
        </NavLink>
        <NavLink
          to="/leaderboard/waifu"
          className={({ isActive }) =>
            `${isActive ? "bg-btn-primary text-txt-inverse" : "bg-bgc-layer-semi-neutral text-txt-primary"} rounded-[32px] px-3 py-1.5 text-center text-xs leading-normal font-medium backdrop-blur-[3.4px] sm:text-base`
          }
        >
          Top Harem
        </NavLink>
      </div>

      {/* Title */}
      <h1 className="w-full text-center text-4xl leading-10 font-semibold">Top những dàn harem mạnh nhất lịch sử</h1>

      {/* Leaderboard List */}
      <div className="bg-bgc-layer1 mx-auto flex w-full max-w-[750px] flex-col gap-4 space-y-0 overflow-hidden rounded-2xl px-4 py-4">
        {isLoading && (
          <div className="py-8 text-center">
            <div className="text-txt-secondary font-sans text-base leading-6 font-medium">
              Đang tải...
            </div>
          </div>
        )}

        {error && (
          <div className="py-8 text-center">
            <div className="font-sans text-base leading-6 font-medium text-red-500">
              {error}
            </div>
          </div>
        )}

        {!isLoading && !error && leaderboardData.length === 0 && (
          <div className="py-8 text-center">
            <div className="text-txt-secondary font-sans text-base leading-6 font-medium">
              Chưa có dữ liệu bảng xếp hạng
            </div>
          </div>
        )}

        {!isLoading &&
          !error &&
          leaderboardData.map((leaderboard, index) => (
            <LeaderboardUserWaifuItem
              key={leaderboard.userId}
              leaderboard={leaderboard}
              index={index + 1}
              expandTopN={5}
            />
          ))}
      </div>
    </div>
  );
}
