import { type MetaFunction, useLoaderData, useLocation } from "react-router-dom";

import { getTopUser } from "@/queries/user.query";

import RatingItemUser from "~/components/rating-item-user";
import type { UserType } from "~/database/models/user.model";

export const meta: MetaFunction = () => {
  return [
    { title: "Bảng xếp hạng thành viên | VinaHentai" },
    {
      name: "description",
      content: "Xem bảng xếp hạng thành viên xuất sắc nhất tại VinaHentai",
    },
  ];
};

export async function loader() {
  const topUsers = await getTopUser(100);
  return Response.json(
    { topUsers },
    {
      headers: {
        "Cache-Control": "public, max-age=21600, s-maxage=21600",
      },
    },
  );
}

export default function LeaderboardMember() {
  const { topUsers } = useLoaderData<{ topUsers: UserType[] }>();
  const { pathname } = useLocation();
  

  return (
    <div className="container-page flex flex-col items-center justify-center gap-11 px-4 py-8 md:px-6 lg:px-0">
      {/* Tab buttons */}
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

      {/* Title */}
      <h1 className="w-full text-center text-4xl leading-10 font-semibold">
        Thánh Lọ Bảng
      </h1>

      {/* Bỏ phần Top 3 Members để tiết kiệm diện tích */}

      {/* Other Members List */}
      <div className="bg-bgc-layer1 border-bd-default w-full max-w-[750px] space-y-0 overflow-hidden rounded-2xl border p-0 py-4">
        {topUsers.map((user, index) => (
          <RatingItemUser key={user.id} user={user} index={index + 1} />
        ))}
      </div>
    </div>
  );
}
