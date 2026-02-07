// BEGIN <feature> HOT_SECTION_AUTOSCROLL_IMPORTS

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Flame, Trophy } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
// import { useSearchParams } from "react-router-dom";

import { getHotCarouselLeaderboard, getLeaderboard } from "@/queries/leaderboad.query";
import { getNewCosplay, getNewManga } from "@/queries/manga.query";
import { getTopUser } from "@/queries/user.query";
import { getTranslatorLeaderboard } from "@/queries/translator-leaderboard.query";
import { getRecentMangaComments } from "@/queries/comment.query";

import type { Route } from "./+types/_index";

// List section moved into a dedicated component
import LatestUpdates from "~/components/latest-updates";
import CosplayPreviewGrid from "~/components/cosplay-preview-grid";
import RatingItem from "~/components/rating-item";
import RatingItemUser from "~/components/rating-item-user";
import RatingItemTranslator from "~/components/rating-item-translator";
import { TopBanner, type TopBannerHandle } from "~/components/top-banner";
import TopBannerMobileGrid from "~/components/top-banner-mobile-grid";
import RecentCommentsFeed from "~/components/recent-comments-feed";
import type { MangaType } from "~/database/models/manga.model";
import LazyRender from "~/components/lazy-render";
import type { ReactNode } from "react";

const HOT_BANNER_MAX_ITEMS = 12;

// Responsive wrapper to choose rootMargin depending on viewport width.
function ResponsiveLazyRender({
  children,
  placeholder,
  once,
}: {
  children: ReactNode;
  placeholder?: ReactNode;
  once?: boolean;
}) {
  const [rootMargin, setRootMargin] = useState("1500px");

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setRootMargin(mq.matches ? "2500px" : "1500px");
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update as any);
    };
  }, []);

  return (
    <LazyRender rootMargin={rootMargin} placeholder={placeholder} once={once}>
      {children}
    </LazyRender>
  );
}
// END <feature> HOT_SECTION_AUTOSCROLL_IMPORTS

export async function loader({ request }: Route.LoaderArgs) {
  const { getCanonicalOrigin } = await import("~/.server/utils/canonical-url");

  const [topUser, hotLeaderboard, weeklyLeaderboard, latestPage, recentComments, cosplayPreview, weeklyTranslatorLeaderboard] =
    await Promise.all([
      getTopUser(),
      getHotCarouselLeaderboard(),
      getLeaderboard("weekly"),
      // Bỏ fetch monthly để lazy load phía client khi user mở tab
      // Lấy 40 truyện đầu để hiển thị 4x10 trên trang chủ
      getNewManga(1, 40, { minChapters: 1 }),
      getRecentMangaComments(1, 5),
      getNewCosplay(1, 4),
      getTranslatorLeaderboard("weekly", 10),
    ]);

  return {
    origin: getCanonicalOrigin(request as any),
    topUser,
    hotLeaderboard,
    weeklyLeaderboard,
    latestPage,
    recentComments,
    cosplayPreview,
    weeklyTranslatorLeaderboard,
  };
}

export function meta({ data }: Route.MetaArgs) {
  const origin = data?.origin ?? "https://vinahentai.fun";
  const canonical = origin ? `${origin}/` : "/";
  return [
    { title: "Vinahentai - Đọc truyện hentai 18+ KHÔNG QUẢNG CÁO" },
    {
      name: "description",
      content:
        "Vinahentai - Trang đọc truyện hentai, manhwa 18+ vietsub, hentaiVN,... KHÔNG QUẢNG CÁO, cập nhật nhanh, đa dạng thể loại. Trải nghiệm ngay!",
    },
    { property: "og:url", content: canonical },
    { name: "twitter:url", content: canonical },
  ];
}
function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const [isPastHalf, setIsPastHalf] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      setVisible(scrollTop > 500); // hiện khi cuộn > 500px

      const doc = document.documentElement;
      const maxScroll = Math.max(0, doc.scrollHeight - window.innerHeight);
      const progress = maxScroll > 0 ? scrollTop / maxScroll : 0;
      setIsPastHalf(progress >= 0.5);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  const handleClick = () => {
    if (isPastHalf) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const leaderboardEl = document.getElementById("home-leaderboard");
    if (leaderboardEl) {
      leaderboardEl.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  };

  return (
    <button
      aria-label={isPastHalf ? "Lên đầu trang" : "Đến bảng xếp hạng"}
      onClick={handleClick}
      className="lg:hidden fixed bottom-13 right-5 z-50 rounded-full bg-black/40 p-3 text-white shadow-md backdrop-blur-sm transition-all duration-300 hover:bg-black/60 active:scale-95"
    >
      {isPastHalf ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
    </button>
  );
}


export default function Index({ loaderData }: Route.ComponentProps) {
  const {
    topUser,
    hotLeaderboard,
    weeklyLeaderboard,
    latestPage,
    recentComments,
    cosplayPreview,
    weeklyTranslatorLeaderboard,
  } = loaderData;

  // Dùng MobileGrid cho mobile/tablet, và TopBanner (5 cột + nút click) cho desktop
  const topDesktopRef = useRef<TopBannerHandle | null>(null);

  // Nguồn HOT gốc (daily ưu tiên). Nếu daily quá ít (<5) thì fallback weekly cho đủ hiển thị.
  const candidateDaily = (hotLeaderboard as MangaType[]).filter(Boolean);
  const candidateWeekly = (weeklyLeaderboard as MangaType[]).filter(Boolean);
  const bannerBase =
    (candidateDaily.length >= 5
      ? candidateDaily
      : candidateWeekly.length > 0
        ? candidateWeekly
        : candidateDaily) || [];

  // Tin cậy server đã khử trùng lặp + giới hạn. Không dedupe phía client để tránh khác biệt SSR/CSR.
  // Đồng thời “chốt” danh sách ngay lần đầu có dữ liệu để tránh nháy do revalidation trả về ít hơn tạm thời.
  const [bannerSource, setBannerSource] = useState<MangaType[]>(() => (bannerBase ?? []).slice(0, HOT_BANNER_MAX_ITEMS));
  const hasLatchedRef = useRef<boolean>(false);
  useEffect(() => {
  const next = (bannerBase ?? []).slice(0, HOT_BANNER_MAX_ITEMS);
    if (!hasLatchedRef.current) {
      // Lần đầu có dữ liệu → chốt để không bị co lại sau hydrate/revalidate
      if (next.length > 0) {
        setBannerSource(next);
        hasLatchedRef.current = true;
      }
      return;
    }
    // Sau khi đã chốt: chỉ cập nhật khi không làm GIẢM số lượng (tránh nháy co lại)
    if (next.length >= bannerSource.length) {
      setBannerSource(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bannerBase]);

  // Dev debug: expose nguồn HOT đã khử trùng lặp ra window để so sánh trước/sau hydrate
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      (window as any).__BANNER_SOURCE__ = bannerSource.map((m: any) => ({
        id: m?._id ?? m?.id ?? null,
        title: m?.title ?? m?.name ?? null,
      }));
      if (localStorage.getItem("debug_hot") === "1") {
        // eslint-disable-next-line no-console
        console.log("[HOT] bannerSource(len=", bannerSource.length, ")", (window as any).__BANNER_SOURCE__);
      }
    } catch {}
  }, [bannerSource]);

  // Không can thiệp vào cơ chế điều hướng toàn cục nữa; chỉ xử lý dữ liệu tại chỗ.

  return (
    <> 
  <div className="container-page mx-auto px-4 pt-3 pb-6 md:py-6">
      {/* SEO giữ tiêu đề nhưng ẩn */}
      <h1 className="sr-only">
        Vinahentai – Truyện hentai 18+ vietsub, KHÔNG QUẢNG CÁO hot nhất 2025
      </h1>

      {/* HOT section */}
      <div className="flex items-center gap-2 px-1 pb-3">
        <Flame className="h-5 w-5 text-red-400" aria-hidden="true" />
        <h2 className="text-txt-primary text-xl font-semibold uppercase">Truyện HOT</h2>
      </div>
      <section className="min-w-0">
        {/* Mobile/Tablet: 2x2 grid carousel */}
        <div className="relative md:hidden">
          <div className="mx-auto w-full">
            <TopBannerMobileGrid items={bannerSource} />
          </div>
        </div>

        {/* Desktop: TopBanner (5 cột) + 2 nút click trái/phải */}
        <div className="relative hidden md:block">
          <div className="overflow-x-hidden">
            <div className="hot-rail">
              <TopBanner ref={topDesktopRef} bannerItems={bannerSource} />
            </div>
          </div>

          {/* Nút trái/phải */}
          <button
            aria-label="Trước"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 px-3 py-6 text-white hover:bg-black/65"
            onClick={() => topDesktopRef.current?.prev()}
          >
            ‹
          </button>
          <button
            aria-label="Sau"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 px-3 py-6 text-white hover:bg-black/65"
            onClick={() => topDesktopRef.current?.next()}
          >
            ›
          </button>
        </div>
      </section>

      {/* Ẩn banner tím cũ */}
      <div className="hidden" aria-hidden="true" />

  {/* Lưới nội dung còn lại */}
  <div className="mt-[18px] grid grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-[minmax(0,1fr)_27%]">
        {/* Truyện mới cập nhật */}
        <div className="min-w-0 space-y-8">
          <LatestUpdates
            initialData={(latestPage as any)?.manga ?? (latestPage as any)?.data ?? []}
            initialPage={(latestPage as any)?.currentPage ?? 1}
            initialTotalPages={(latestPage as any)?.totalPages ?? 1}
            // Remove internal top margin to align heading baseline with right column
            containerClassName="mt-0"
            indexMode
            showPagination={false}
          />
          <CosplayPreviewGrid items={(cosplayPreview as any)?.manga ?? (cosplayPreview as any)?.data ?? []} />
        </div>

          {/* Bảng bình luận gần đây + Bảng xếp hạng + Doanh thu + Thành viên */}
        <section className="mt-0 w-full sm:justify-self-end">
          <div className="space-y-10">
            {/* Bảng Xếp Hạng */}
            <ResponsiveLazyRender
              placeholder={
                <div
                  id="home-leaderboard"
                  className="space-y-6 scroll-mt-[calc(var(--site-header-height)+12px)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative h-[15px] w-[15px]">
                      <div className="h-4 w-4 rounded bg-[rgba(255,255,255,0.02)] animate-pulse" />
                    </div>
                    <div className="h-6 w-40 rounded bg-[rgba(255,255,255,0.02)] animate-pulse" />
                  </div>
                  <div className="bg-bgc-layer1 border-bd-default overflow-hidden rounded-2xl border p-4 py-8">
                    <div className="h-36 w-full rounded bg-[rgba(255,255,255,0.02)] animate-pulse" />
                  </div>
                </div>
              }
              once
            >
              <div
                id="home-leaderboard"
                className="space-y-6 scroll-mt-[calc(var(--site-header-height)+12px)]"
              >
              <div className="flex items-center gap-3">
                <Trophy className="h-6 w-6 text-lav-500" />
                <h2 className="text-txt-primary text-xl font-semibold uppercase">
                  bảng xếp hạng
                </h2>
              </div>

              <div className="bg-bgc-layer1 border-bd-default overflow-hidden rounded-2xl border p-0">
                <LeaderboardWeeklyMonthly weekly={weeklyLeaderboard as MangaType[]} />
              </div>
              </div>
            </ResponsiveLazyRender>

            {/* Bình luận gần đây - lazy render */}
            <ResponsiveLazyRender
              placeholder={
                <div className="bg-bgc-layer1 border-bd-default overflow-hidden rounded-2xl border p-4 py-8">
                  <div className="h-36 w-full rounded bg-[rgba(255,255,255,0.02)] animate-pulse" />
                </div>
              }
              once
            >
              <RecentCommentsFeed
                initialData={(recentComments as any)?.data ?? []}
                initialPage={(recentComments as any)?.currentPage ?? 1}
                initialTotalPages={(recentComments as any)?.totalPages ?? 1}
                showPagination
              />
            </ResponsiveLazyRender>

            {/* TOP DOANH THU — tạm ẩn hoàn toàn khỏi index */}

            {/* Thánh Lọ Bảng */}
            <ResponsiveLazyRender
              placeholder={
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="relative h-[15px] w-[15px]">
                      <img
                        src="/images/icons/multi-star.svg"
                        alt=""
                        className="absolute top-0 left-[4.62px] h-4"
                      />
                    </div>
                    <h2 className="text-txt-primary text-xl font-semibold uppercase">Thánh Lọ Bảng</h2>
                  </div>
                  <div className="bg-bgc-layer1 border-bd-default overflow-hidden rounded-2xl border p-4 py-8">
                    <div className="h-36 w-full rounded bg-[rgba(255,255,255,0.02)] animate-pulse" />
                  </div>
                </div>
              }
              once
            >
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
                    Thánh Lọ Bảng
                  </h2>
                </div>

                <div className="bg-bgc-layer1 border-bd-default space-y-0 overflow-hidden rounded-2xl border p-0 py-4">
                  {topUser.map((user, index) => (
                    <RatingItemUser key={user.id} user={user} index={index + 1} />
                  ))}
                </div>
              </div>
            </ResponsiveLazyRender>

            {/* BXH Dịch Giả */}
            <ResponsiveLazyRender
              placeholder={
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="relative h-[15px] w-[15px]">
                      <div className="h-4 w-4 rounded bg-[rgba(255,255,255,0.02)] animate-pulse" />
                    </div>
                    <h2 className="text-txt-primary text-xl font-semibold uppercase">BXH Dịch Giả</h2>
                  </div>
                  <div className="bg-bgc-layer1 border-bd-default overflow-hidden rounded-2xl border p-4 py-8">
                    <div className="h-36 w-full rounded bg-[rgba(255,255,255,0.02)] animate-pulse" />
                  </div>
                </div>
              }
              once
            >
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="relative h-[15px] w-[15px]">
                    <div className="h-4 w-4 rounded bg-[rgba(255,255,255,0.08)]" />
                  </div>
                  <h2 className="text-txt-primary text-xl font-semibold uppercase">BXH Dịch Giả</h2>
                </div>

                <div className="bg-bgc-layer1 border-bd-default space-y-0 overflow-hidden rounded-2xl border p-0 py-4">
                  {(weeklyTranslatorLeaderboard || []).map((row: any, index: number) => (
                    <RatingItemTranslator key={row.userId || index} row={row} index={index + 1} />
                  ))}
                </div>
              </div>
            </ResponsiveLazyRender>
          </div>
        </section>
      </div>
    </div>
    <ScrollToTopButton />
    </>
  );
}

// Component phân trang + lazy load tab tháng cho BXH
function LeaderboardWeeklyMonthly({ weekly }: { weekly: MangaType[] }) {
  const [tab, setTab] = useState("weekly");
  const [weeklyPage, setWeeklyPage] = useState(1);
  const [monthlyLoaded, setMonthlyLoaded] = useState(false);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyData, setMonthlyData] = useState<MangaType[]>([]);
  const [monthlyPage, setMonthlyPage] = useState(1);

  const weeklyPage1 = (weekly || []).slice(0, 5);
  const weeklyPage2 = (weekly || []).slice(5, 10);
  const monthlyPage1 = (monthlyData || []).slice(0, 5);
  const monthlyPage2 = (monthlyData || []).slice(5, 10);

  return (
    <Tabs.Root
      value={tab}
      onValueChange={(v) => {
        setTab(v);
        if (v === "monthly" && !monthlyLoaded) {
          setMonthlyLoaded(true);
          setMonthlyLoading(true);
          fetch(`/api/leaderboard/manga?period=monthly&limit=10`)
            .then((r) => r.json())
            .then((json) => { if (json?.success) setMonthlyData(json.data || []); })
            .catch(() => {})
            .finally(() => setMonthlyLoading(false));
        }
      }}
      className="w-full"
    >
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
        {(weeklyPage === 1 ? weeklyPage1 : weeklyPage2).map((m, i) => (
          <RatingItem
            key={(m as MangaType).id}
            manga={m as MangaType}
            index={weeklyPage === 1 ? i + 1 : i + 6}
            usePortraitThumb
          />
        ))}
        {weeklyPage === 1 && weeklyPage2.length > 0 && (
          <div className="px-3 pb-2 pt-1">
            <button
              onClick={() => setWeeklyPage(2)}
              className="w-full rounded-md bg-white/5 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Trang 2 ▸
            </button>
          </div>
        )}
        {weeklyPage === 2 && (
          <div className="px-3 pb-2 pt-1">
            <button
              onClick={() => setWeeklyPage(1)}
              className="w-full rounded-md bg-white/5 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              ◂ Quay lại trang 1
            </button>
          </div>
        )}
      </Tabs.Content>
      <Tabs.Content value="monthly" className="space-y-0 pb-4">
        {!monthlyLoaded && (
          <div className="p-3"><div className="h-16 w-full animate-pulse rounded bg-white/5" /></div>
        )}
        {monthlyLoaded && monthlyLoading && (
          <div className="p-3"><div className="h-16 w-full animate-pulse rounded bg-white/5" /></div>
        )}
        {monthlyLoaded && !monthlyLoading && (
          <>
            {(monthlyPage === 1 ? monthlyPage1 : monthlyPage2).map((m, i) => (
              <RatingItem
                key={(m as MangaType).id}
                manga={m as MangaType}
                index={monthlyPage === 1 ? i + 1 : i + 6}
                usePortraitThumb
              />
            ))}
            {monthlyPage === 1 && monthlyPage2.length > 0 && (
              <div className="px-3 pb-2 pt-1">
                <button onClick={() => setMonthlyPage(2)} className="w-full rounded-md bg-white/5 py-2 text-sm font-medium text-white hover:bg-white/10">Trang 2 ▸</button>
              </div>
            )}
            {monthlyPage === 2 && (
              <div className="px-3 pb-2 pt-1">
                <button onClick={() => setMonthlyPage(1)} className="w-full rounded-md bg-white/5 py-2 text-sm font-medium text-white hover:bg-white/10">◂ Quay lại trang 1</button>
              </div>
            )}
          </>
        )}
      </Tabs.Content>
    </Tabs.Root>
  );
}