// BEGIN <feature> HOT_SECTION_AUTOSCROLL_IMPORTS
import { useEffect, useRef } from "react";
import * as Tabs from "@radix-ui/react-tabs";

import { getLeaderboard } from "@/queries/leaderboad.query";
import { getRevenuesByPeriod } from "@/queries/manga-revenue.query";
import { getTopUser } from "@/queries/user.query";

import type { Route } from "./+types/_index";

import DialogWarningAdultContent from "~/components/dialog-warning-adult-content";
import { LoadingSpinner } from "~/components/loading-spinner";
import { MangaCard } from "~/components/manga-card";
import { Pagination } from "~/components/pagination";
import RatingItem from "~/components/rating-item";
import RatingItemUser from "~/components/rating-item-user";
import { TopBanner } from "~/components/top-banner";
import type { MangaType } from "~/database/models/manga.model";
import { usePagination } from "~/hooks/use-pagination";

/**
 * Tìm phần tử scrollable đầu tiên trong cây con
 */
function findScrollable(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  const stack: HTMLElement[] = [el];
  while (stack.length) {
    const node = stack.shift()!;
    const sw = node.scrollWidth;
    const cw = node.clientWidth;
    const sh = node.scrollHeight;
    const ch = node.clientHeight;
    if ((sw > cw || sh > ch) && getComputedStyle(node).overflowX !== "visible") {
      return node;
    }
    for (const child of Array.from(node.children)) {
      stack.push(child as HTMLElement);
    }
  }
  return null;
}
// END <feature> HOT_SECTION_AUTOSCROLL_IMPORTS

export async function loader() {
  const [
    revenuesByPeriod,
    topUser,
    dailyLeaderboard,
    weeklyLeaderboard,
    monthlyLeaderboard,
  ] = await Promise.all([
    getRevenuesByPeriod("monthly"),
    getTopUser(),
    getLeaderboard("daily"),
    getLeaderboard("weekly"),
    getLeaderboard("monthly"),
  ]);

  return {
    revenuesByPeriod,
    topUser,
    dailyLeaderboard,
    weeklyLeaderboard,
    monthlyLeaderboard,
  };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Vinahentai - Đọc hentai 18+ ÍT QUẢNG CÁO hot nhất 2025" },
    {
      name: "description",
      content:
        "Vinahentai - Trang đọc truyện hentai, manhwa 18+ vietsub, hentaiVN không che. Ít quảng cáo, cập nhật nhanh, đa dạng thể loại hot nhất 2025. Trải nghiệm ngay!",
    },
  ];
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const {
    revenuesByPeriod,
    topUser,
    dailyLeaderboard,
    weeklyLeaderboard,
    monthlyLeaderboard,
  } = loaderData;

  const {
    data: mangaList,
    currentPage,
    totalPages,
    isLoading,
    goToPage,
  } = usePagination<MangaType>({
    apiUrl: "/api/manga/latest",
    limit: 20,
  });

  // BEGIN <feature> HOT_SECTION_AUTOSCROLL_LOGIC
  const hotWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mql =
      typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)") : null;
    if (!mql || !mql.matches) return;

    const wrap = hotWrapRef.current;
    if (!wrap) return;

    const scroller = findScrollable(wrap);
    if (!scroller) return;

    let raf = 0;
    let paused = false;
    const speedPxPerFrame = 0.6;

    const tick = () => {
      if (!paused) {
        const max = scroller.scrollWidth - scroller.clientWidth;
        if (max > 0) {
          if (scroller.scrollLeft >= max - 1) {
            scroller.scrollLeft = 0;
          } else {
            scroller.scrollLeft += speedPxPerFrame;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    const onEnter = () => (paused = true);
    const onLeave = () => (paused = false);
    const onVisibility = () => {
      paused = document.hidden || !mql.matches;
    };

    scroller.addEventListener("mouseenter", onEnter);
    scroller.addEventListener("mouseleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      scroller.removeEventListener("mouseenter", onEnter);
      scroller.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  // END <feature> HOT_SECTION_AUTOSCROLL_LOGIC

  return (
    <div className="container-ad mx-auto px-4 py-6">
      <DialogWarningAdultContent />

      {/* Giữ cho SEO nhưng ẩn hoàn toàn */}
      <h1 className="sr-only">
        Vinahentai – Đọc hentai 18+ vietsub, ít quảng cáo hot nhất 2025
      </h1>

      {/* BEGIN <feature> HOT_SECTION_MINW0_VIEWPORT + DESKTOP_5COLUMNS_AUTOSCROLL */}
      <section className="min-w-0">
        {/* Mobile/Tablet: giữ nguyên TopBanner cũ */}
        <div className="lg:hidden">
          <div className="mx-auto w-full">
            <TopBanner
              bannerItems={
                dailyLeaderboard.length > 0
                  ? (dailyLeaderboard as MangaType[]).filter((m) => !!m)
                  : (weeklyLeaderboard as MangaType[]).filter((m) => !!m)
              }
            />
          </div>
        </div>

        {/* Desktop: ép 5 ô/viewport + auto-scroll (pause khi hover) */}
        <div ref={hotWrapRef} className="hidden lg:block">
          <div className="overflow-x-hidden">
            <div className="hot-rail">
              <TopBanner
                bannerItems={
                  dailyLeaderboard.length > 0
                    ? (dailyLeaderboard as MangaType[]).filter((m) => !!m)
                    : (weeklyLeaderboard as MangaType[]).filter((m) => !!m)
                }
              />
            </div>
          </div>

          <style>{`
            @media (min-width: 1024px) {
              .hot-rail > * { min-width: 0; }
              .hot-rail > * > * {
                flex: 0 0 calc(100% / 5);
                max-width: calc(100% / 5);
              }
            }
          `}</style>
        </div>
      </section>
      {/* END <feature> HOT_SECTION_MINW0_VIEWPORT + DESKTOP_5COLUMNS_AUTOSCROLL */}

      {/* BEGIN <feature> HIDE_VINAHENTAI_BANNER */}
      {/* Ẩn banner tím "vinahentai" ở mọi nơi để không còn hiển thị, 
          vẫn giữ <h1 sr-only> cho SEO. Không ảnh hưởng layout khác. */}
      <div className="hidden" aria-hidden="true">
        {/* (trước đây là <img className="pt-10" src="/images/home/vnht.svg" alt="..."/>)
            Nếu muốn giữ khoảng cách cũ, có thể thêm <div className="pt-10" /> */}
      </div>
      {/* END <feature> HIDE_VINAHENTAI_BANNER */}

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

          {isLoading && mangaList.length === 0 ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {mangaList?.map((manga) => (
                  <MangaCard key={manga.id} manga={manga} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-8 flex justify-center">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={goToPage}
                  />
                </div>
              )}
            </>
          )}
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
