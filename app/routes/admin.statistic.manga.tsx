import { type MetaFunction, NavLink, useLoaderData } from "react-router-dom";
import * as Tabs from "@radix-ui/react-tabs";
import { BookOpen, Eye, Users } from "lucide-react";

import { getLeaderboard } from "@/queries/leaderboad.query";
import { getHotCarouselLeaderboardWithScores, type HotCarouselScoreRow } from "@/queries/leaderboad.query";
import { getStatistic } from "@/queries/statistic.query";

import RatingItem from "~/components/rating-item";
import type { MangaType } from "~/database/models/manga.model";

interface StatisticData {
  totalMembers: number;
  totalManga: number;
  totalViews: number;
  dailyLeaderboard: MangaType[];
  weeklyLeaderboard: MangaType[];
  monthlyLeaderboard: MangaType[];
  hotCarousel: HotCarouselScoreRow[];
}

export const meta: MetaFunction = () => {
  return [
    { title: "Thống kê Truyện | Admin" },
    { name: "description", content: "Trang thống kê dữ liệu truyện trong hệ thống" },
  ];
};

export async function loader(): Promise<Response> {
  // Lấy dữ liệu thống kê và leaderboard từ database
  const statistic = await getStatistic();
  const dailyLeaderboard = await getLeaderboard("daily");
  const weeklyLeaderboard = await getLeaderboard("weekly");
  const monthlyLeaderboard = await getLeaderboard("monthly");
  const hotCarousel = await getHotCarouselLeaderboardWithScores();

  return Response.json({
    ...statistic,
    dailyLeaderboard,
    weeklyLeaderboard,
    monthlyLeaderboard,
    hotCarousel,
  });
}

export default function AdminStatistic() {
  const data = useLoaderData<StatisticData>();

  const tabs = [
    { key: "manga" as const, label: "Top Truyện tranh" },
    { key: "member" as const, label: "Thánh Lọ Bảng" },
  ];

  const periods = [
    { key: "month" as const, label: "Top tháng", data: data?.monthlyLeaderboard || [] },
    { key: "week" as const, label: "Top tuần", data: data?.weeklyLeaderboard || [] },
    { key: "day" as const, label: "Top ngày", data: data?.dailyLeaderboard || [] },
  ];

  if (!data) {
    return <div>Loading...</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-[968px] flex-col items-center justify-center gap-6 p-4 md:p-6 lg:p-8">
      {/* Statistics Cards */}
      <div className="flex w-full flex-col items-center justify-center gap-6 md:flex-row">
        <div className="bg-bgc-layer1 border-bd-default flex w-full items-start justify-between rounded-xl border p-3 md:w-56">
          <div className="flex flex-col items-start justify-start gap-2">
            <div className="text-txt-secondary font-sans text-xs leading-none font-medium">
              Số thành viên
            </div>
            <div className="text-txt-primary font-sans text-xl leading-7 font-semibold">
              {data.totalMembers}
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center opacity-60">
            <Users className="text-txt-secondary h-10 w-10" />
          </div>
        </div>

        <div className="bg-bgc-layer1 border-bd-default flex w-full items-start justify-between rounded-xl border p-3 md:w-56">
          <div className="flex flex-col items-start justify-start gap-2">
            <div className="text-txt-secondary font-sans text-xs leading-none font-medium">
              Truyện đã đăng
            </div>
            <div className="text-txt-primary font-sans text-xl leading-7 font-semibold">
              {data.totalManga}
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center opacity-60">
            <BookOpen className="text-txt-secondary h-10 w-10" />
          </div>
        </div>

        <div className="bg-bgc-layer1 border-bd-default flex w-full items-start justify-between rounded-xl border p-3 md:w-56">
          <div className="flex flex-col items-start justify-start gap-2">
            <div className="text-txt-secondary font-sans text-xs leading-none font-medium">
              Lượt đọc
            </div>
            <div className="text-txt-primary font-sans text-xl leading-7 font-semibold">
              {data.totalViews.toLocaleString()}
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center opacity-60">
            <Eye className="text-txt-secondary h-10 w-10" />
          </div>
        </div>
      </div>

      {/* Tab Selection and Title */}
      <div className="flex w-full flex-col items-center justify-start gap-6">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {tabs.map((tab) => (
            <NavLink
              to={`/admin/statistic/${tab.key}`}
              key={tab.key}
              className={({ isActive }) =>
                isActive
                  ? "bg-btn-primary text-txt-primary rounded-[32px]"
                  : "bg-bgc-layer-semi-neutral text-txt-primary rounded-[32px]"
              }
            >
              <button className="flex cursor-pointer items-center justify-center gap-1.5 rounded-[32px] px-3 py-1.5 transition-colors">
                <div className="font-sans text-base leading-normal font-medium">
                  {tab.label}
                </div>
              </button>
            </NavLink>
          ))}
        </div>

        <div className="text-txt-primary w-full text-center font-sans text-2xl leading-10 font-semibold md:text-4xl">
          TOP TRUYỆN TRANH
        </div>
      </div>

      {/* Ranking Table with Radix Tabs */}
      <div className="border-bd-default bg-bgc-layer1 flex w-full flex-col rounded-xl border">
        <Tabs.Root defaultValue="month" className="w-full">
          {/* Period Tabs */}
          <Tabs.List className="border-bd-default flex w-full border-b">
            {periods.map((period) => (
              <Tabs.Trigger
                key={period.key}
                value={period.key}
                className="data-[state=active]:border-lav-500 data-[state=active]:text-txt-primary data-[state=inactive]:text-txt-secondary flex flex-1 items-center justify-center gap-2.5 p-3 transition-colors data-[state=active]:border-b data-[state=active]:font-semibold data-[state=inactive]:font-medium"
              >
                <div className="font-sans text-base leading-normal">{period.label}</div>
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {/* Tab Content */}
          {periods.map((period) => (
            <Tabs.Content key={period.key} value={period.key} className="flex flex-col">
              {period.data.length > 0 ? (
                period.data.map((manga: MangaType, index: number) => (
                  <div
                    key={manga.id}
                    className="border-bd-default border-b last:border-b-0"
                  >
                    <RatingItem manga={manga} index={index + 1} />
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center p-8">
                  <div className="text-txt-secondary font-sans text-base">
                    Không có dữ liệu cho khoảng thời gian này
                  </div>
                </div>
              )}
            </Tabs.Content>
          ))}
        </Tabs.Root>
      </div>

      {/* Hot score breakdown table */}
      <div className="border-bd-default bg-bgc-layer1 flex w-full flex-col rounded-xl border">
        <div className="border-bd-default flex flex-col gap-1 border-b p-4">
          <div className="text-txt-primary font-sans text-lg font-semibold">
            Danh sách truyện HOT (kèm score + công thức tính)
          </div>
          <div className="text-txt-secondary font-sans text-xs">
            {data.hotCarousel?.[0]?.formula ?? "adjusted = baseScore * (1 - (weeklyPenalty + monthlyPenalty)) * recentMultiplier * genreMultiplier"}
          </div>
          <div className="text-txt-secondary font-sans text-xs">
            Lưu ý: nếu có genre <span className="font-semibold">manhwa</span> thì trừ <span className="font-semibold">35%</span> (nhân 0.65) và <span className="font-semibold">không áp dụng</span> bonus cập nhật gần đây (12h). Các truyện không phải manhwa nếu vừa cập nhật gần đây (12h) thì cộng <span className="font-semibold">25%</span> (nhân 1.25).
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[860px] table-auto">
            <thead>
              <tr className="border-bd-default border-b">
                <th className="text-txt-secondary p-3 text-left text-xs font-medium">#</th>
                <th className="text-txt-secondary p-3 text-left text-xs font-medium">Truyện</th>
                <th className="text-txt-secondary p-3 text-left text-xs font-medium">Adjusted score</th>
                <th className="text-txt-secondary p-3 text-left text-xs font-medium">Base score</th>
                <th className="text-txt-secondary p-3 text-left text-xs font-medium">Chi tiết tính điểm</th>
              </tr>
            </thead>
            <tbody>
              {(data.hotCarousel || []).length > 0 ? (
                (data.hotCarousel || []).map((row) => {
                  const story = row.story as MangaType & { slug?: string; title?: string };
                  const href = story.slug ? `/truyen-hentai/${story.slug}` : undefined;
                  return (
                    <tr key={row.id} className="border-bd-default border-b last:border-b-0 align-top">
                      <td className="text-txt-primary p-3 text-sm">{row.rank}</td>
                      <td className="p-3">
                        <div className="text-txt-primary text-sm font-medium">
                          {href ? (
                            <a href={href} className="hover:underline">
                              {story.title || story.slug || row.id}
                            </a>
                          ) : (
                            story.title || story.slug || row.id
                          )}
                        </div>
                        <div className="text-txt-secondary text-xs">{row.lastInteractionAt ? `lastInteraction: ${row.lastInteractionAt}` : ""}</div>
                      </td>
                      <td className="text-txt-primary p-3 text-sm">{Number.isFinite(row.adjustedScore) ? row.adjustedScore.toFixed(4) : String(row.adjustedScore)}</td>
                      <td className="text-txt-secondary p-3 text-sm">{Number.isFinite(row.baseScore) ? row.baseScore.toFixed(4) : String(row.baseScore)}</td>
                      <td className="p-3">
                        <div className="text-txt-secondary whitespace-pre-wrap text-xs leading-5">
                          {(row.steps || []).join("\n")}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <div className="text-txt-secondary font-sans text-base">
                      Không có dữ liệu HOT carousel
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
