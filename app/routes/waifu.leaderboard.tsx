import { redirect, useLoaderData } from "react-router";

import { getAllOpenedBanners } from "@/queries/banner.query";

import LeaderboardUserWaifuItem from "~/components/leaderboard-user-waifu-item";
import { LoadingSpinner } from "~/components/loading-spinner";
import { Pagination } from "~/components/pagination";
import { SummonNavigationBar } from "~/components/summon-navigation-bar";
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

  const {
    data: leaderboardData,
    currentPage,
    totalPages,
    isLoading,
    error,
    goToPage,
  } = usePagination({
    apiUrl: "/api/waifu/leaderboard",
    limit: 5,
  });

  return (
    <div className="relative w-full">
      {/* Navigation Bar - chung cho cả mobile và desktop */}
      <SummonNavigationBar navItems={navItems} />

      {/* Title */}
      <h1 className="my-8 w-full text-center text-4xl leading-10 font-semibold">
        BẢNG XẾP HẠNG
      </h1>

      {/* Bỏ phần Top 3 Waifu để giao diện gọn nhẹ */}

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
