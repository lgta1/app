import { type MetaFunction, NavLink, useLoaderData } from "react-router-dom";
import * as Tabs from "@radix-ui/react-tabs";
import { BookOpen, Eye, Users } from "lucide-react";

import { getLeaderboard } from "@/queries/leaderboad.query";
import { forceRefreshHotCarouselSnapshot, getHotCarouselSnapshotInfo, getHotCarouselSnapshotWithScores, type HotCarouselScoreRow } from "@/queries/leaderboad.query";
import { getDailyRegistrationAndMangaStats, getStatistic, type DailySeriesPoint } from "@/queries/statistic.query";

import RatingItem from "~/components/rating-item";
import type { MangaType } from "~/database/models/manga.model";

interface StatisticData {
  totalMembers: number;
  totalManga: number;
  totalViews: number;
  dailyRegistrations: DailySeriesPoint[];
  dailyMangasCreated: DailySeriesPoint[];
  dailyStatsTimezone: string;
  dailyLeaderboard: MangaType[];
  weeklyLeaderboard: MangaType[];
  monthlyLeaderboard: MangaType[];
  hotCarousel: HotCarouselScoreRow[];
  hotCarouselSnapshotComputedAt: string | null;
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
  const dailyStats = await getDailyRegistrationAndMangaStats(15);
  const dailyLeaderboard = await getLeaderboard("daily");
  const weeklyLeaderboard = await getLeaderboard("weekly");
  const monthlyLeaderboard = await getLeaderboard("monthly");
  const hotCarousel = await getHotCarouselSnapshotWithScores();
  const snapshotInfo = await getHotCarouselSnapshotInfo();

  return Response.json({
    ...statistic,
    dailyRegistrations: dailyStats.registrations,
    dailyMangasCreated: dailyStats.mangasCreated,
    dailyStatsTimezone: dailyStats.timezone,
    dailyLeaderboard,
    weeklyLeaderboard,
    monthlyLeaderboard,
    hotCarousel,
    hotCarouselSnapshotComputedAt: snapshotInfo.computedAt,
  });
}

export async function action({ request }: { request: Request }): Promise<Response> {
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  if (intent === "refreshHotCarousel") {
    await forceRefreshHotCarouselSnapshot();
    const url = new URL(request.url);
    return Response.redirect(url.pathname, 303);
  }
  return Response.json({ ok: false }, { status: 400 });
}

export default function AdminStatistic() {
  const data = useLoaderData<StatisticData>();
  const registrationSeries = data.dailyRegistrations || [];
  const mangaSeries = data.dailyMangasCreated || [];

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

  const renderSummary = (series: DailySeriesPoint[]) => {
    const total = series.reduce((sum, point) => sum + (point.count || 0), 0);
    const avg = series.length > 0 ? Math.round(total / series.length) : 0;
    const maxPoint = series.reduce<DailySeriesPoint | null>(
      (acc, point) => (!acc || point.count > acc.count ? point : acc),
      null,
    );
    return {
      total,
      avg,
      maxPoint,
    };
  };

  const renderBarChart = (
    title: string,
    subtitle: string,
    series: DailySeriesPoint[],
    barClassName: string,
  ) => {
    const maxValue = Math.max(0, ...series.map((point) => point.count));
    const summary = renderSummary(series);

    return (
      <div className="border-bd-default bg-bgc-layer1 flex w-full flex-col rounded-xl border p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-txt-primary text-base font-semibold">{title}</div>
            <div className="text-txt-secondary text-xs">{subtitle}</div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="text-txt-secondary">
              Tổng 15 ngày: <span className="text-txt-primary font-semibold">{summary.total}</span>
            </div>
            <div className="text-txt-secondary">
              TB/ngày: <span className="text-txt-primary font-semibold">{summary.avg}</span>
            </div>
            <div className="text-txt-secondary">
              Cao nhất: {summary.maxPoint ? (
                <span className="text-txt-primary font-semibold">
                  {summary.maxPoint.count} ({summary.maxPoint.label})
                </span>
              ) : (
                <span className="text-txt-primary font-semibold">0</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex h-52 items-end gap-2">
          {series.map((point) => {
            const safeValue = point.count || 0;
            const percent = maxValue > 0 ? Math.round((safeValue / maxValue) * 100) : 0;
            const heightPercent = safeValue === 0 ? 2 : Math.max(8, percent);
            return (
              <div key={point.dateKey} className="flex min-w-0 flex-1 flex-col items-center">
                <div className="text-txt-secondary mb-1 text-[10px] font-medium">
                  {safeValue}
                </div>
                <div
                  className={`w-full rounded-md ${barClassName}`}
                  style={{ height: `${heightPercent}%` }}
                  title={`${point.label}: +${safeValue} (Tổng cuối ngày: ${point.total})`}
                />
                <div className="text-txt-secondary mt-1 text-[10px]">
                  {point.label}
                </div>
                <div className="text-txt-secondary mt-1 text-[10px]">
                  {point.total}
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-txt-secondary mt-2 text-[11px]">
          Hàng số dưới cùng = tổng cộng dồn đến cuối ngày.
        </div>
      </div>
    );
  };

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

      {/* Daily Growth Charts */}
      <div className="flex w-full flex-col gap-4">
        {renderBarChart(
          "Đăng ký mới (15 ngày gần nhất)",
          `Tính theo ngày — múi giờ ${data.dailyStatsTimezone}`,
          registrationSeries,
          "bg-gradient-to-t from-[#4FD1C5] via-[#38B2AC] to-[#0BC5EA]",
        )}
        {renderBarChart(
          "Truyện đã đăng (15 ngày gần nhất)",
          `Tính theo ngày — múi giờ ${data.dailyStatsTimezone}`,
          mangaSeries,
          "bg-gradient-to-t from-[#C466FF] via-[#A855F7] to-[#7C3AED]",
        )}
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
            Snapshot computedAt: {data.hotCarouselSnapshotComputedAt ?? "(chưa có snapshot)"}
          </div>
          <form method="post" className="mt-1">
            <button
              type="submit"
              name="intent"
              value="refreshHotCarousel"
              className="bg-btn-primary text-txt-primary rounded-md px-3 py-1 text-xs font-semibold"
            >
              Force refresh HOT snapshot
            </button>
          </form>
          <div className="text-txt-secondary font-sans text-xs">
            {data.hotCarousel?.[0]?.formula ?? "adjusted = baseScore * (1 - clamp(weeklyPenalty + monthlyPenalty, 0..0.70)) * updateBoostMultiplier * genreMultiplier * disturbingMultiplier"}
          </div>
          <div className="text-txt-secondary font-sans text-xs">
            Lưu ý: baseScore chỉ tính từ <span className="font-semibold">views</span> (không tính comments). Penalty top tuần/tháng áp dụng cộng dồn (weekly + monthly) và chặn tối đa <span className="font-semibold">70%</span>. UpdateBoost dựa theo <span className="font-semibold">updatedAt</span>: 0–2h ×1.50, 2–6h ×1.40, 6–12h ×1.30, 12–24h ×1.20, &gt;24h ×1.0. Nếu có genre <span className="font-semibold">manhwa</span> thì trừ <span className="font-semibold">70%</span> (nhân 0.30) và <span className="font-semibold">vẫn được</span> UpdateBoost. Nếu có tag <span className="font-semibold">guro</span>/<span className="font-semibold">scat</span> thì <span className="font-semibold">không áp dụng</span> UpdateBoost và bị trừ <span className="font-semibold">50%</span> điểm (nhân 0.5).
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
