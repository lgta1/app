import * as Tabs from "@radix-ui/react-tabs";

import { getChapterByMangaId } from "@/queries/chapter.query";
import { getLeaderboard } from "@/queries/leaderboad.query";
import { getMangaById, getRelatedManga } from "@/queries/manga.query";
import { getRevenuesByPeriod } from "@/queries/manga-revenue.query";
import { getTopUser } from "@/queries/user.query";
import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/manga.$id";

import CommentDetail from "~/components/comment-detail";
import { MangaDetail } from "~/components/manga-detail";
import RatingItem from "~/components/rating-item";
import RatingItemUser from "~/components/rating-item-user";
import RelatedManga from "~/components/related-manga";
import type { MangaType } from "~/database/models/manga.model";
import { BusinessError } from "~/helpers/errors.helper";
import { isAdmin } from "~/helpers/user.helper";

export async function loader({ params, request }: Route.LoaderArgs) {
  const { id } = params;

  const manga = await getMangaById(id);

  if (!manga) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  const [
    chapters,
    relatedManga,
    hotManga,
    topUser,
    weeklyLeaderboard,
    monthlyLeaderboard,
    currentUser,
  ] = await Promise.all([
    getChapterByMangaId(manga.id),
    getRelatedManga(manga.genres),
    getRevenuesByPeriod("monthly"),
    getTopUser(),
    getLeaderboard("weekly"),
    getLeaderboard("monthly"),
    getUserInfoFromSession(request),
  ]);

  return {
    manga,
    chapters,
    relatedManga,
    hotManga,
    topUser,
    weeklyLeaderboard,
    monthlyLeaderboard,
    isLoggedIn: !!currentUser,
    isAdmin: isAdmin(currentUser?.role ?? ""),
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
    manga,
    chapters,
    relatedManga,
    hotManga,
    topUser,
    weeklyLeaderboard,
    monthlyLeaderboard,
    isLoggedIn,
    isAdmin: userIsAdmin,
  } = loaderData;

  return (
    <div className="container-ad mx-auto px-4 py-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
        {/* Section chi tiết truyện */}
        <section className="md:mt-8">
          <MangaDetail manga={manga} chapters={chapters} />
          <CommentDetail
            mangaId={manga.id}
            isLoggedIn={isLoggedIn}
            isAdmin={userIsAdmin}
          />
          <RelatedManga mangaList={relatedManga} />
        </section>

        {/* Section bảng xếp hạng */}
        <section className="mt-8">
          <div className="space-y-10">
            {/* Bảng Xếp Hạng */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="relative h-[15px] w-[15px]">
                  <img
                    src="/images/home/star-icon-1.svg"
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
                    src="/images/home/star-icon-1.svg"
                    alt=""
                    className="absolute top-0 left-[4.62px] h-4"
                  />
                </div>
                <h2 className="text-txt-primary text-xl font-semibold uppercase">
                  TOP DOANH THU
                </h2>
              </div>

              <div className="bg-bgc-layer1 border-bd-default space-y-0 overflow-hidden rounded-2xl border p-0 py-4">
                {hotManga.map((manga, index) => (
                  <RatingItem key={manga.id} manga={manga} index={index + 1} />
                ))}
              </div>
            </div>

            {/* TOP THÀNH VIÊN */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="relative h-[15px] w-[15px]">
                  <img
                    src="/images/home/star-icon-1.svg"
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
