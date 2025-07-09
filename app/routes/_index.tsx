import * as Tabs from "@radix-ui/react-tabs";

import { getLeaderboard } from "@/queries/leaderboad.query";
import { getNewManga } from "@/queries/manga.query";
import { getRevenuesByPeriod } from "@/queries/manga-revenue.query";
import { getTopUser } from "@/queries/user.query";

import type { Route } from "./+types/_index";

import DialogWarningAdultContent from "~/components/dialog-warning-adult-content";
import { InfinityLoadingTrigger } from "~/components/infinity-loading-trigger";
import { MangaCard } from "~/components/manga-card";
import RatingItem from "~/components/rating-item";
import RatingItemUser from "~/components/rating-item-user";
import { TopBanner } from "~/components/top-banner";
import type { MangaType } from "~/database/models/manga.model";
import { useInfinityLoading } from "~/hooks/use-infinity-loading";

export async function loader() {
  const [
    revenuesByPeriod,
    newManga,
    topUser,
    dailyLeaderboard,
    weeklyLeaderboard,
    monthlyLeaderboard,
  ] = await Promise.all([
    getRevenuesByPeriod("monthly"),
    getNewManga(1, 16),
    getTopUser(),
    getLeaderboard("daily"),
    getLeaderboard("weekly"),
    getLeaderboard("monthly"),
  ]);

  return {
    revenuesByPeriod,
    newManga,
    topUser,
    dailyLeaderboard,
    weeklyLeaderboard,
    monthlyLeaderboard,
  };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "WuxiaWorld - Đọc truyện online" },
    { name: "description", content: "WuxiaWorld - Nền tảng đọc truyện online" },
  ];
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const {
    revenuesByPeriod,
    newManga,
    topUser,
    dailyLeaderboard,
    weeklyLeaderboard,
    monthlyLeaderboard,
  } = loaderData;

  const {
    data: mangaList,
    isLoading,
    hasMore,
    loadingRef,
    loadMore,
  } = useInfinityLoading<MangaType>({
    initialData: newManga,
    apiUrl: "/api/manga/latest",
    limit: 16,
    autoLoad: false,
  });

  return (
    <div className="container-ad mx-auto px-4 py-6">
      <DialogWarningAdultContent />

      <TopBanner
        bannerItems={
          dailyLeaderboard.length > 0
            ? (dailyLeaderboard as MangaType[]).filter((manga) => !!manga)
            : (weeklyLeaderboard as MangaType[]).filter((manga) => !!manga)
        }
      />

      <img className="pt-10" src="/images/home/vnht.svg" alt="" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
        {/* Section truyện mới cập nhật */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative h-[15px] w-[15px]">
                <img
                  src="/images/icons/multi-star.svg"
                  alt=""
                  className="absolute top-0 left-[4.62px] h-4"
                />
              </div>
              <h2 className="text-txt-primary text-xl font-semibold uppercase">
                truyện mới cập nhật
              </h2>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-4">
            {mangaList?.map((manga) => <MangaCard key={manga.id} manga={manga} />)}
          </div>

          {/* Loading indicator và trigger cho infinity scroll */}
          <div ref={loadingRef}>
            <InfinityLoadingTrigger
              isAutoLoad={false}
              isLoading={isLoading}
              hasMore={hasMore}
              onLoadMore={loadMore}
            />
          </div>
        </section>

        {/* Section bảng xếp hạng */}
        <section className="mt-8">
          <div className="space-y-10">
            {/* Bảng Xếp Hạng */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="relative h-[15px] w-[15px]">
                  <img
                    src="/images/icons/multi-star.svg"
                    alt=""
                    className="absolute top-0 left-[4.62px] h-4"
                  />
                </div>
                <h2 className="text-txt-primary text-xl font-semibold uppercase">
                  bảng xếp hạng
                </h2>
              </div>

              <div className="bg-bgc-layer1 border-bd-default overflow-hidden rounded-2xl border p-0">
                <Tabs.Root defaultValue="weekly" className="w-full">
                  {/* Tab Navigation */}
                  <Tabs.List className="border-bd-default flex border-b">
                    <Tabs.Trigger
                      value="weekly"
                      className="data-[state=active]:border-lav-500 data-[state=active]:text-txt-primary text-txt-secondary hover:text-txt-primary flex-1 cursor-pointer bg-transparent px-3 py-3 text-base font-medium transition-colors data-[state=active]:border-b-2 data-[state=active]:font-semibold"
                    >
                      Top tuần
                    </Tabs.Trigger>
                    <Tabs.Trigger
                      value="monthly"
                      className="data-[state=active]:border-lav-500 data-[state=active]:text-txt-primary text-txt-secondary hover:text-txt-primary flex-1 cursor-pointer bg-transparent px-3 py-3 text-base font-medium transition-colors data-[state=active]:border-b-2 data-[state=active]:font-semibold"
                    >
                      Top tháng
                    </Tabs.Trigger>
                  </Tabs.List>

                  {/* Ranking Lists */}
                  <Tabs.Content value="weekly" className="space-y-0 pb-4">
                    {weeklyLeaderboard.map(
                      (manga, index) =>
                        manga && (
                          <RatingItem
                            key={(manga as MangaType).id}
                            manga={manga as MangaType}
                            index={index + 1}
                          />
                        ),
                    )}
                  </Tabs.Content>

                  <Tabs.Content value="monthly" className="space-y-0 pb-4">
                    {monthlyLeaderboard.map(
                      (manga, index) =>
                        manga && (
                          <RatingItem
                            key={(manga as MangaType).id}
                            manga={manga as MangaType}
                            index={index + 1}
                          />
                        ),
                    )}
                  </Tabs.Content>
                </Tabs.Root>
              </div>
            </div>

            {/* TOP DOANH THU */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="relative h-[15px] w-[15px]">
                  <img
                    src="/images/icons/multi-star.svg"
                    alt=""
                    className="absolute top-0 left-[4.62px] h-4"
                  />
                </div>
                <h2 className="text-txt-primary text-xl font-semibold uppercase">
                  TOP DOANH THU
                </h2>
              </div>

              <div className="bg-bgc-layer1 border-bd-default space-y-0 overflow-hidden rounded-2xl border p-0 py-4">
                {revenuesByPeriod.map((manga, index) => (
                  <RatingItem key={manga.id} manga={manga} index={index + 1} />
                ))}
              </div>
            </div>

            {/* TOP THÀNH VIÊN */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="relative h-[15px] w-[15px]">
                  <img
                    src="/images/icons/multi-star.svg"
                    alt=""
                    className="absolute top-0 left-[4.62px] h-4"
                  />
                </div>
                <h2 className="text-txt-primary text-xl font-semibold uppercase">
                  TOP THÀNH VIÊN
                </h2>
              </div>

              <div className="bg-bgc-layer1 border-bd-default space-y-0 overflow-hidden rounded-2xl border p-0 py-4">
                {topUser.map((user, index) => (
                  <RatingItemUser key={user.id} user={user} index={index + 1} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
