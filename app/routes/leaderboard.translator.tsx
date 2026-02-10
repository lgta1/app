import { type MetaFunction, useLoaderData, useLocation } from "react-router-dom";
import * as Tabs from "@radix-ui/react-tabs";

import { getTranslatorLeaderboard } from "@/queries/translator-leaderboard.query";
import RatingItemTranslator from "~/components/rating-item-translator";

export const meta: MetaFunction = () => {
  return [
    { title: "Bảng xếp hạng dịch giả | VinaHentai" },
    {
      name: "description",
      content: "Xem bảng xếp hạng dịch giả theo lượt xem truyện tại VinaHentai",
    },
  ];
};

export async function loader() {
  const [weekly, monthly, alltime] = await Promise.all([
    getTranslatorLeaderboard("weekly", 50),
    getTranslatorLeaderboard("monthly", 50),
    getTranslatorLeaderboard("alltime", 50),
  ]);

  return Response.json(
    { weekly, monthly, alltime },
    {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    },
  );
}

export default function LeaderboardTranslator() {
  const { weekly, monthly, alltime } = useLoaderData<typeof loader>();
  const { pathname } = useLocation();

  return (
    <div className="container-page flex flex-col items-center justify-center gap-11 px-4 py-8 md:px-6 lg:px-0">
      <div className="flex items-center justify-start gap-2 sm:gap-4">
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
      </div>

      <h1 className="w-full text-center text-4xl leading-10 font-semibold">BXH Dịch Giả</h1>

      <div className="w-full max-w-[750px] rounded-xl bg-slate-950 outline-1 outline-offset-[-1px] outline-slate-700">
        <Tabs.Root defaultValue="alltime" className="w-full">
          <Tabs.List className="flex w-full border-b border-slate-700">
            <Tabs.Trigger
              value="alltime"
              className="data-[state=active]:border-lav-500 data-[state=active]:text-txt-primary text-txt-secondary hover:text-txt-primary flex-1 cursor-pointer bg-transparent px-3 py-3 text-base font-medium transition-colors data-[state=active]:border-b-2 data-[state=active]:font-semibold"
            >
              Mọi thời đại
            </Tabs.Trigger>
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

          <Tabs.Content value="alltime" className="space-y-0 pb-4">
            {(alltime || []).map((row: any, index: number) => (
              <RatingItemTranslator key={row.userId || index} row={row} index={index + 1} />
            ))}
          </Tabs.Content>

          <Tabs.Content value="monthly" className="space-y-0 pb-4">
            {(monthly || []).map((row: any, index: number) => (
              <RatingItemTranslator key={row.userId || index} row={row} index={index + 1} />
            ))}
          </Tabs.Content>

          <Tabs.Content value="weekly" className="space-y-0 pb-4">
            <div className="px-3 pt-3 text-xs text-txt-secondary">
              Thưởng tuần được gửi vào sáng thứ 2 khi kết thúc tuần. 1000 views = 1 dâm ngọc.
            </div>
            {(weekly || []).map((row: any, index: number) => (
              <RatingItemTranslator key={row.userId || index} row={row} index={index + 1} showReward />
            ))}
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}
