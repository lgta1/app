import { redirect } from "react-router";

import { getAllOpenedBanners } from "@/queries/banner.query";

import LeaderboardUserWaifuItem from "~/components/leaderboard-user-waifu-item";
import { SummonNavigationBar } from "~/components/summon-navigation-bar";
import type { UserWaifuLeaderboardType } from "~/database/models/user-waifu-leaderboard.model";
import { getWaifuLeaderboardSnapshot } from "~/.server/services/waifu-leaderboard.svc";

import type { Route } from "./+types/waifu.leaderboard";

export async function loader({}: Route.LoaderArgs) {
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

    const history = await getWaifuLeaderboardSnapshot(1, 100);

    return Response.json(
      {
        navItems,
        leaderboardData: history.data,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=43200, s-maxage=43200",
        },
      },
    );
  } catch (error) {
    console.error("Error loading banners:", error);
    throw redirect("/");
  }
}

export default function WaifuSummon({ loaderData }: Route.ComponentProps) {
  const { navItems, leaderboardData } = loaderData;

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
        {leaderboardData.length === 0 && (
          <div className="py-8 text-center">
            <div className="text-txt-secondary font-sans text-base leading-6 font-medium">
              Chưa có dữ liệu bảng xếp hạng
            </div>
          </div>
        )}

        {leaderboardData.map((leaderboard, index) => (
          <LeaderboardUserWaifuItem
            key={leaderboard.userId}
            leaderboard={leaderboard}
            index={index + 1}
          />
        ))}
      </div>
    </div>
  );
}
