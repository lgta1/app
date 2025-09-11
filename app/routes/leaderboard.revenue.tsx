import { useState } from "react";
import { type MetaFunction, NavLink, useLoaderData } from "react-router-dom";
import * as Tabs from "@radix-ui/react-tabs";

import { getRevenuesByPeriod } from "@/queries/manga-revenue.query";

import LeaderboardTopManga from "~/components/leaderboard-top-manga";
import RatingItemRevenue from "~/components/rating-item-revenue";
import type { MangaType } from "~/database/models/manga.model";

export const meta: MetaFunction = () => {
  return [
    { title: "Bảng xếp hạng doanh thu | VinaHentai" },
    {
      name: "description",
      content: "Xem bảng xếp hạng truyện theo doanh thu tại VinaHentai",
    },
  ];
};

export async function loader() {
  const [weeklyLeaderboard, monthlyLeaderboard] = await Promise.all([
    getRevenuesByPeriod("weekly"),
    getRevenuesByPeriod("monthly"),
  ]);

  return {
    weeklyLeaderboard,
    monthlyLeaderboard,
  };
}

export default function LeaderboardIndex() {
  const { weeklyLeaderboard, monthlyLeaderboard } = useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState<"monthly" | "weekly">("monthly");

  const getTopThreeManga = () => {
    switch (activeTab) {
      case "weekly":
        return weeklyLeaderboard?.slice(0, 3) as MangaType[];
      case "monthly":
      default:
        return monthlyLeaderboard?.slice(0, 3) as MangaType[];
    }
  };

  return (
    <div className="container-ad flex flex-col items-center justify-center gap-11 px-4 py-8 md:px-6 lg:px-0">
      {/* Tab buttons */}
      <div className="flex items-center justify-start gap-2 sm:gap-4">
        <NavLink
          to="/leaderboard/manga"
          className={({ isActive }) =>
            `${isActive ? "bg-btn-primary text-txt-inverse" : "bg-bgc-layer-semi-neutral text-txt-primary"} rounded-[32px] px-3 py-1.5 text-center text-xs leading-normal font-medium backdrop-blur-[3.4px] sm:text-base`
          }
        >
          Top Truyện tranh
        </NavLink>
        <NavLink
          to="/leaderboard/revenue"
          className={({ isActive }) =>
            `${isActive ? "bg-btn-primary text-txt-inverse" : "bg-bgc-layer-semi-neutral text-txt-primary"} rounded-[32px] px-3 py-1.5 text-center text-xs leading-normal font-medium backdrop-blur-[3.4px] sm:text-base`
          }
        >
          Top Doanh thu
        </NavLink>
        <NavLink
          to="/leaderboard/member"
          className={({ isActive }) =>
            `${isActive ? "bg-btn-primary text-txt-inverse" : "bg-bgc-layer-semi-neutral text-txt-primary"} rounded-[32px] px-3 py-1.5 text-center text-xs leading-normal font-medium backdrop-blur-[3.4px] sm:text-base`
          }
        >
          Top Thành viên
        </NavLink>
      </div>

      {/* Title */}
      <h1 className="w-full text-center text-4xl leading-10 font-semibold">
        TOP DOANH THU
      </h1>

      {/* Top 3 Banner */}
      <LeaderboardTopManga topManga={getTopThreeManga()} />

      {/* Leaderboard List */}
      <div className="w-full max-w-[750px] rounded-xl bg-slate-950 outline-1 outline-offset-[-1px] outline-slate-700">
        <Tabs.Root
          defaultValue="monthly"
          className="w-full"
          onValueChange={(value) => setActiveTab(value as "monthly" | "weekly")}
        >
          {/* Tab Navigation */}
          <Tabs.List className="flex w-full border-b border-slate-700">
            <Tabs.Trigger
              value="monthly"
              className="data-[state=active]:border-lav-500 data-[state=active]:text-txt-primary text-txt-secondary hover:text-txt-primary flex-1 cursor-pointer bg-transparent px-3 py-3 text-base font-medium transition-colors data-[state=active]:border-b-2 data-[state=active]:font-semibold"
            >
              Top tháng
            </Tabs.Trigger>
            <Tabs.Trigger
              value="weekly"
              className="data-[state=active]:border-lav-500 data-[state=active]:text-txt-primary text-txt-secondary hover:text-txt-primary flex-1 cursor-pointer bg-transparent px-3 py-3 text-base font-medium transition-colors data-[state=active]:border-b-2 data-[state=active]:font-semibold"
            >
              Top tuần
            </Tabs.Trigger>
          </Tabs.List>

          {/* Ranking Lists */}
          <Tabs.Content value="monthly" className="space-y-0 pb-4">
            {monthlyLeaderboard
              ?.filter((manga) => !!manga)
              .map((manga, index) => (
                <RatingItemRevenue key={manga.id} manga={manga} index={index + 1} />
              ))}
          </Tabs.Content>

          <Tabs.Content value="weekly" className="space-y-0 pb-4">
            {weeklyLeaderboard
              ?.filter((manga) => !!manga)
              .map((manga, index) => (
                <RatingItemRevenue key={manga.id} manga={manga} index={index + 1} />
              ))}
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}
