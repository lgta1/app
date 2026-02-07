import { type MetaFunction, useLoaderData, useLocation } from "react-router-dom";
import { isMobile } from "react-device-detect";
import * as Tabs from "@radix-ui/react-tabs";

import { getLeaderboard } from "@/queries/leaderboad.query";

import RatingItem from "~/components/rating-item";
import type { MangaType } from "~/database/models/manga.model";

export const meta: MetaFunction = () => {
  return [
    { title: "Bảng xếp hạng truyện | VinaHentai" },
    {
      name: "description",
      content: "Xem bảng xếp hạng truyện phổ biến nhất tại VinaHentai",
    },
  ];
};

export async function loader() {
  const [dailyLeaderboard, weeklyLeaderboard, monthlyLeaderboard] = await Promise.all([
    getLeaderboard("daily"),
    getLeaderboard("weekly"),
    getLeaderboard("monthly"),
  ]);

  return Response.json(
    {
      dailyLeaderboard: dailyLeaderboard.length > 0 ? dailyLeaderboard : weeklyLeaderboard,
      weeklyLeaderboard,
      monthlyLeaderboard,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=600, s-maxage=600",
      },
    },
  );
}

export default function LeaderboardIndex() {
  const { dailyLeaderboard, weeklyLeaderboard, monthlyLeaderboard } =
    useLoaderData<typeof loader>();
  const { pathname } = useLocation();
  

  return (
    <div className="container-page flex flex-col items-center justify-center gap-11 px-4 py-8 md:px-6 lg:px-0">
      {/* Tab buttons */}
      <div className="flex items-center justify-start gap-2 sm:gap-4">
        {isMobile ? (
          <>
            <a
              href="/leaderboard/manga"
              aria-current={pathname === "/leaderboard/manga" ? "page" : undefined}
              className={`${pathname === "/leaderboard/manga" ? "bg-btn-primary text-txt-inverse" : "bg-bgc-layer-semi-neutral text-txt-primary"} rounded-[32px] px-3 py-1.5 text-center text-xs leading-normal font-medium backdrop-blur-[3.4px] sm:text-base touch-manipulation [touch-action:manipulation]`}
            >
              Top Truyện hentai
            </a>
            <a
              href="/leaderboard/member"
              aria-current={pathname === "/leaderboard/member" ? "page" : undefined}
              className={`${pathname === "/leaderboard/member" ? "bg-btn-primary text-txt-inverse" : "bg-bgc-layer-semi-neutral text-txt-primary"} rounded-[32px] px-3 py-1.5 text-center text-xs leading-normal font-medium backdrop-blur-[3.4px] sm:text-base touch-manipulation [touch-action:manipulation]`}
            >
              Thánh Lọ Bảng
            </a>
            <a
              href="/leaderboard/waifu"
              aria-current={pathname === "/leaderboard/waifu" ? "page" : undefined}
              className={`${pathname === "/leaderboard/waifu" ? "bg-btn-primary text-txt-inverse" : "bg-bgc-layer-semi-neutral text-txt-primary"} rounded-[32px] px-3 py-1.5 text-center text-xs leading-normal font-medium backdrop-blur-[3.4px] sm:text-base touch-manipulation [touch-action:manipulation]`}
            >
              Top Harem
            </a>
            <a
              href="/leaderboard/translator"
              aria-current={pathname === "/leaderboard/translator" ? "page" : undefined}
              className={`${pathname === "/leaderboard/translator" ? "bg-btn-primary text-txt-inverse" : "bg-bgc-layer-semi-neutral text-txt-primary"} rounded-[32px] px-3 py-1.5 text-center text-xs leading-normal font-medium backdrop-blur-[3.4px] sm:text-base touch-manipulation [touch-action:manipulation]`}
            >
              BXH Dịch Giả
            </a>
          </>
        ) : (
          <>
            <a
              href="/leaderboard/manga"
              aria-current={pathname === "/leaderboard/manga" ? "page" : undefined}
              className={`${pathname === "/leaderboard/manga" ? "bg-btn-primary text-txt-inverse" : "bg-bgc-layer-semi-neutral text-txt-primary"} rounded-[32px] px-3 py-1.5 text-center text-xs leading-normal font-medium backdrop-blur-[3.4px] sm:text-base touch-manipulation [touch-action:manipulation]`}
            >
              Top Truyện hentai
            </a>
            <a
              href="/leaderboard/member"
              aria-current={pathname === "/leaderboard/member" ? "page" : undefined}
              className={`${pathname === "/leaderboard/member" ? "bg-btn-primary text-txt-inverse" : "bg-bgc-layer-semi-neutral text-txt-primary"} rounded-[32px] px-3 py-1.5 text-center text-xs leading-normal font-medium backdrop-blur-[3.4px] sm:text-base touch-manipulation [touch-action:manipulation]`}
            >
              Thánh Lọ Bảng
            </a>
            <a
              href="/leaderboard/waifu"
              aria-current={pathname === "/leaderboard/waifu" ? "page" : undefined}
              className={`${pathname === "/leaderboard/waifu" ? "bg-btn-primary text-txt-inverse" : "bg-bgc-layer-semi-neutral text-txt-primary"} rounded-[32px] px-3 py-1.5 text-center text-xs leading-normal font-medium backdrop-blur-[3.4px] sm:text-base touch-manipulation [touch-action:manipulation]`}
            >
              Top Harem
            </a>
            <a
              href="/leaderboard/translator"
              aria-current={pathname === "/leaderboard/translator" ? "page" : undefined}
              className={`${pathname === "/leaderboard/translator" ? "bg-btn-primary text-txt-inverse" : "bg-bgc-layer-semi-neutral text-txt-primary"} rounded-[32px] px-3 py-1.5 text-center text-xs leading-normal font-medium backdrop-blur-[3.4px] sm:text-base touch-manipulation [touch-action:manipulation]`}
            >
              BXH Dịch Giả
            </a>
          </>
        )}
      </div>

      {/* Title */}
      <h1 className="w-full text-center text-4xl leading-10 font-semibold">
        TOP TRUYỆN HENTAI
      </h1>

      {/* Leaderboard List */}
      <div className="w-full max-w-[750px] rounded-xl bg-slate-950 outline-1 outline-offset-[-1px] outline-slate-700">
        <Tabs.Root
          defaultValue="monthly"
          className="w-full"
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
                <RatingItem key={manga.id} manga={manga} index={index + 1} usePortraitThumb />
              ))}
          </Tabs.Content>

          <Tabs.Content value="weekly" className="space-y-0 pb-4">
            {(weeklyLeaderboard as MangaType[])
              ?.filter((manga) => !!manga)
              .map((manga, index) => (
                <RatingItem key={manga.id} manga={manga} index={index + 1} usePortraitThumb />
              ))}
          </Tabs.Content>

          <Tabs.Content value="daily" className="space-y-0 pb-4">
            {(dailyLeaderboard as MangaType[])
              ?.filter((manga) => !!manga)
              .map((manga, index) => (
                <RatingItem key={manga.id} manga={manga} index={index + 1} usePortraitThumb />
              ))}
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}
