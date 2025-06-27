import { useEffect, useState } from "react";
import { redirect, useLoaderData } from "react-router";

import { getAllOpenedBanners } from "@/queries/banner.query";

import { LeaderboardTopUserWaifu } from "~/components/leaderboard-top-user-waifu";
import LeaderboardUserWaifuItem from "~/components/leaderboard-user-waifu-item";
import { LoadingSpinner } from "~/components/loading-spinner";
import { Pagination } from "~/components/pagination";
import { SummonNavigationBar } from "~/components/summon-navigation-bar";
import type { UserWaifuLeaderboardType } from "~/database/models/user-waifu-leaderboard";
import { usePagination } from "~/hooks/use-pagination";

export async function loader() {
  try {
    const banners = await getAllOpenedBanners();

    if (banners.length === 0) {
      throw redirect("/");
    }

    const navItems = banners.map((banner, index) => ({
      label: banner.isRateUp ? `Banner rate up ${index + 1}` : "Banner thường",
      to: `/waifu/summon/${banner.id}`,
      id: banner.id,
    }));

    navItems.push({
      label: "Bảng xếp hạng",
      to: "/waifu/leaderboard",
      id: "leaderboard",
    });

    return { navItems };
  } catch (error) {
    console.error("Error loading banners:", error);
    throw redirect("/");
  }
}

export default function WaifuSummon() {
  const { navItems } = useLoaderData<typeof loader>();
  const [top3Users, setTop3Users] = useState<UserWaifuLeaderboardType[]>([]);

  const {
    data: leaderboardData,
    currentPage,
    totalPages,
    isLoading,
    error,
    goToPage,
  } = usePagination<UserWaifuLeaderboardType>({
    apiUrl: "/api/waifu/leaderboard",
    limit: 5,
  });

  useEffect(() => {
    if (currentPage === 1 && leaderboardData.length > 0) {
      setTop3Users(leaderboardData.slice(0, 3));
    }
  }, [currentPage, leaderboardData]);

  return (
    <div className="relative w-full">
      {/* Navigation Bar - chung cho cả mobile và desktop */}
      <SummonNavigationBar navItems={navItems} />

      {/* Title */}
      <h1 className="my-8 w-full text-center text-4xl leading-10 font-semibold">
        BẢNG XẾP HẠNG
      </h1>

      {/* Top 3 Members */}
      {top3Users.length > 0 && (
        <div className="hidden w-full flex-row items-center justify-center overflow-x-auto lg:flex">
          {/* #2 */}
          {top3Users[1] && (
            <div className="relative m-8">
              <LeaderboardTopUserWaifu
                leaderboard={top3Users[1]}
                gradientStyle="bg-[radial-gradient(ellipse_125.31%_134.25%_at_9.92%_4.55%,_rgba(234.16,_234.16,_234.16,_0.30)_0%,_rgba(42.91,_42.79,_42.08,_0.30)_69%)]"
                borderColor="outline-gray-400"
                shadowColor="shadow-[0px_0px_44.20000076293945px_0px_rgba(163,175,186,0.22)]"
              />
              <div className="absolute top-0 left-0 flex -translate-1/2 items-center justify-center">
                <img
                  src="/images/leaderboard/2.svg"
                  alt="Rank 2"
                  className="h-14 w-auto"
                />
              </div>
            </div>
          )}

          {/* #1 */}
          {top3Users[0] && (
            <div className="relative m-8">
              <LeaderboardTopUserWaifu
                leaderboard={top3Users[0]}
                gradientStyle="bg-[radial-gradient(ellipse_125.31%_134.25%_at_9.92%_4.55%,_rgba(255,_224.67,_51.49,_0.30)_0%,_rgba(34.33,_30.05,_5.61,_0.30)_69%)]"
                borderColor="outline-yellow-300"
                shadowColor="shadow-[0px_0px_44.20000076293945px_0px_rgba(255,225,51,0.22)]"
              />
              <div className="absolute top-0 left-0 flex -translate-1/2 items-center justify-center">
                <img
                  src="/images/leaderboard/1.svg"
                  alt="Rank 1"
                  className="h-14 w-auto"
                />
              </div>
            </div>
          )}

          {/* #3 */}
          {top3Users[2] && (
            <div className="relative m-8">
              <LeaderboardTopUserWaifu
                leaderboard={top3Users[2]}
                gradientStyle="bg-[radial-gradient(ellipse_125.31%_134.25%_at_9.92%_4.55%,_rgba(255,_112.54,_51.49,_0.30)_0%,_rgba(34.33,_12.31,_5.61,_0.30)_69%)]"
                borderColor="outline-red-400"
                shadowColor="shadow-[0px_0px_44.20000076293945px_0px_rgba(255,225,51,0.22)]"
              />
              <div className="absolute top-0 left-0 flex -translate-1/2 items-center justify-center">
                <img
                  src="/images/leaderboard/3.svg"
                  alt="Rank 3"
                  className="h-14 w-auto"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {top3Users.length > 0 && (
        <div className="flex w-full flex-col items-center justify-center overflow-x-auto lg:hidden">
          {/* #1 */}
          {top3Users[0] && (
            <div className="relative m-8">
              <LeaderboardTopUserWaifu
                leaderboard={top3Users[0]}
                gradientStyle="bg-[radial-gradient(ellipse_125.31%_134.25%_at_9.92%_4.55%,_rgba(255,_224.67,_51.49,_0.30)_0%,_rgba(34.33,_30.05,_5.61,_0.30)_69%)]"
                borderColor="outline-yellow-300"
                shadowColor="shadow-[0px_0px_44.20000076293945px_0px_rgba(255,225,51,0.22)]"
              />
              <div className="absolute top-0 left-0 flex -translate-1/2 items-center justify-center">
                <img
                  src="/images/leaderboard/1.svg"
                  alt="Rank 1"
                  className="h-14 w-auto"
                />
              </div>
            </div>
          )}

          {/* #2 */}
          {top3Users[1] && (
            <div className="relative m-8">
              <LeaderboardTopUserWaifu
                leaderboard={top3Users[1]}
                gradientStyle="bg-[radial-gradient(ellipse_125.31%_134.25%_at_9.92%_4.55%,_rgba(234.16,_234.16,_234.16,_0.30)_0%,_rgba(42.91,_42.79,_42.08,_0.30)_69%)]"
                borderColor="outline-gray-400"
                shadowColor="shadow-[0px_0px_44.20000076293945px_0px_rgba(163,175,186,0.22)]"
              />
              <div className="absolute top-0 left-0 flex -translate-1/2 items-center justify-center">
                <img
                  src="/images/leaderboard/2.svg"
                  alt="Rank 2"
                  className="h-14 w-auto"
                />
              </div>
            </div>
          )}

          {/* #3 */}
          {top3Users[2] && (
            <div className="relative m-8">
              <LeaderboardTopUserWaifu
                leaderboard={top3Users[2]}
                gradientStyle="bg-[radial-gradient(ellipse_125.31%_134.25%_at_9.92%_4.55%,_rgba(255,_112.54,_51.49,_0.30)_0%,_rgba(34.33,_12.31,_5.61,_0.30)_69%)]"
                borderColor="outline-red-400"
                shadowColor="shadow-[0px_0px_44.20000076293945px_0px_rgba(255,225,51,0.22)]"
              />
              <div className="absolute top-0 left-0 flex -translate-1/2 items-center justify-center">
                <img
                  src="/images/leaderboard/3.svg"
                  alt="Rank 3"
                  className="h-14 w-auto"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Other Members List */}
      <div className="bg-bgc-layer1 mx-auto flex w-full max-w-[750px] flex-col gap-4 space-y-0 overflow-hidden rounded-2xl px-4 py-4">
        {isLoading && (
          <div className="py-8 text-center">
            <div className="text-txt-secondary font-sans text-base leading-6 font-medium">
              <LoadingSpinner />
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
              key={leaderboard.id}
              leaderboard={leaderboard}
              index={(currentPage - 1) * 5 + index + 1}
            />
          ))}
      </div>

      {/* Pagination */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="mt-6 mb-8 flex flex-col items-center justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
          />
        </div>
      )}
    </div>
  );
}
