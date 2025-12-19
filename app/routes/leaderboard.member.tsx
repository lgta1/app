import { type MetaFunction, useLoaderData } from "react-router-dom";
import { NavLink } from "react-router-dom";

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
  return { topUsers };
}

export default function LeaderboardMember() {
  const { topUsers } = useLoaderData<{ topUsers: UserType[] }>();
  

  return (
    <div className="container-page flex flex-col items-center justify-center gap-11 px-4 py-8 md:px-6 lg:px-0">
      {/* Tab buttons */}
      <div className="flex items-center justify-start gap-2 sm:gap-4">
        <NavLink
          to="/leaderboard/manga"
          className={({ isActive }) =>
            `${isActive ? "bg-btn-primary text-txt-inverse" : "bg-bgc-layer-semi-neutral text-txt-primary"} rounded-[32px] px-3 py-1.5 text-center text-xs leading-normal font-medium backdrop-blur-[3.4px] sm:text-base`
          }
        >
          Top Truyện hentai
        </NavLink>
        <NavLink
          to="/leaderboard/member"
          className={({ isActive }) =>
            `${isActive ? "bg-btn-primary text-txt-inverse" : "bg-bgc-layer-semi-neutral text-txt-primary"} rounded-[32px] px-3 py-1.5 text-center text-xs leading-normal font-medium backdrop-blur-[3.4px] sm:text-base`
          }
        >
          Thánh Lọ Bảng
        </NavLink>
        <NavLink
          to="/leaderboard/waifu"
          className={({ isActive }) =>
            `${isActive ? "bg-btn-primary text-txt-inverse" : "bg-bgc-layer-semi-neutral text-txt-primary"} rounded-[32px] px-3 py-1.5 text-center text-xs leading-normal font-medium backdrop-blur-[3.4px] sm:text-base`
          }
        >
          Top Harem
        </NavLink>
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
