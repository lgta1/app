import { useState } from "react";
import { NavLink } from "react-router";
import { useLoaderData } from "react-router";
import * as Tabs from "@radix-ui/react-tabs";

import { getLeaderboard } from "@/queries/leaderboad.query";

import LeaderboardTopManga from "~/components/leaderboard-top-manga";
import RatingItem from "~/components/rating-item";
import type { MangaType } from "~/database/models/manga.model";

export async function loader() {
  const [dailyLeaderboard, weeklyLeaderboard, monthlyLeaderboard] = await Promise.all([
    getLeaderboard("daily"),
    getLeaderboard("weekly"),
    getLeaderboard("monthly"),
  ]);

  return {
    dailyLeaderboard: dailyLeaderboard.length > 0 ? dailyLeaderboard : weeklyLeaderboard,
    weeklyLeaderboard,
    monthlyLeaderboard,
  };
}

export default function LeaderboardIndex() {
  const { dailyLeaderboard, weeklyLeaderboard, monthlyLeaderboard } =
    useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState<"monthly" | "weekly" | "daily">("monthly");

  const getTopThreeManga = () => {
    switch (activeTab) {
      case "daily":
        return dailyLeaderboard?.slice(0, 3) as MangaType[];
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
            `${isActive ? "bg-btn-primary" : "bg-bgc-layer-semi-neutral"} flex items-center justify-center gap-1.5 rounded-[32px] px-3 py-1.5 backdrop-blur-[3.4px]`
          }
        >
          <span className="text-txt-inverse text-xs leading-normal font-medium sm:text-base">
            Top Truyện tranh
          </span>
        </NavLink>
        <NavLink
          to="/leaderboard/revenue"
          className={({ isActive }) =>
            `${isActive ? "bg-btn-primary" : "bg-bgc-layer-semi-neutral"} flex items-center justify-center gap-1.5 rounded-[32px] px-3 py-1.5 backdrop-blur-[3.4px]`
          }
        >
          <span className="text-txt-primary text-xs leading-normal font-medium sm:text-base">
            Top Doanh thu
          </span>
        </NavLink>
        <NavLink
          to="/leaderboard/member"
          className={({ isActive }) =>
            `${isActive ? "bg-btn-primary" : "bg-bgc-layer-semi-neutral"} flex items-center justify-center gap-1.5 rounded-[32px] px-3 py-1.5 backdrop-blur-[3.4px]`
          }
        >
          <span className="text-txt-primary text-xs leading-normal font-medium sm:text-base">
            Top Thành viên
          </span>
        </NavLink>
      </div>

      {/* Title */}
      <h1 className="w-full text-center text-4xl leading-10 font-semibold">
        TOP TRUYỆN TRANH
      </h1>

      {/* Top 3 Banner */}
      <LeaderboardTopManga topManga={getTopThreeManga()} />

      {/* Leaderboard List */}
      <div className="w-full max-w-[750px] rounded-xl bg-slate-950 outline-1 outline-offset-[-1px] outline-slate-700">
        <Tabs.Root
          defaultValue="monthly"
          className="w-full"
          onValueChange={(value) => setActiveTab(value as "monthly" | "weekly" | "daily")}
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
            <Tabs.Trigger
              value="daily"
              className="data-[state=active]:border-lav-500 data-[state=active]:text-txt-primary text-txt-secondary hover:text-txt-primary flex-1 cursor-pointer bg-transparent px-3 py-3 text-base font-medium transition-colors data-[state=active]:border-b-2 data-[state=active]:font-semibold"
            >
              Top ngày
            </Tabs.Trigger>
          </Tabs.List>

          {/* Ranking Lists */}
          <Tabs.Content value="monthly" className="space-y-0 pb-4">
            {(monthlyLeaderboard as MangaType[])
              ?.filter((manga) => !!manga)
              .map((manga, index) => (
                <RatingItem key={manga.id} manga={manga} index={index + 1} />
              ))}
          </Tabs.Content>

          <Tabs.Content value="weekly" className="space-y-0 pb-4">
            {(weeklyLeaderboard as MangaType[])
              ?.filter((manga) => !!manga)
              .map((manga, index) => (
                <RatingItem key={manga.id} manga={manga} index={index + 1} />
              ))}
          </Tabs.Content>

          <Tabs.Content value="daily" className="space-y-0 pb-4">
            {(dailyLeaderboard as MangaType[])
              ?.filter((manga) => !!manga)
              .map((manga, index) => (
                <RatingItem key={manga.id} manga={manga} index={index + 1} />
              ))}
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}
