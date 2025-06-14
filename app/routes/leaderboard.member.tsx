import { type MetaFunction, useLoaderData } from "react-router";
import { NavLink } from "react-router";

import { getTopUser } from "@/queries/user.query";

import { LeaderboardTopUser } from "~/components/leaderboard-top-user";
import RatingItemUser from "~/components/rating-item-user";
import type { UserType } from "~/database/models/user.model";

export const meta: MetaFunction = () => {
  return [
    { title: "Bảng xếp hạng thành viên | WuxiaWorld" },
    {
      name: "description",
      content: "Xem bảng xếp hạng thành viên xuất sắc nhất tại WuxiaWorld",
    },
  ];
};

export async function loader() {
  const topUsers = await getTopUser();
  return { topUsers };
}

export default function LeaderboardMember() {
  const { topUsers } = useLoaderData<{ topUsers: UserType[] }>();
  const top3Users = topUsers.slice(0, 3);

  return (
    <div className="container-ad flex flex-col items-center justify-center gap-11 px-4 py-8 md:px-6 lg:px-0">
      {/* Tab buttons */}
      <div className="flex items-center justify-start gap-2 sm:gap-4">
        <NavLink
          to="/leaderboard/manga"
          className={({ isActive }) =>
            `${isActive ? "bg-btn-primary" : "bg-bgc-layer-semi-neutral"} flex items-center justify-center gap-1.5 rounded-[32px] px-3 py-1.5 backdrop-blur-[3.4px]`
          }
        >
          <span className="text-txt-inverse text-xs leading-normal font-medium sm:text-base">
            Top Truyện tranh
          </span>
        </NavLink>
        <NavLink
          to="/leaderboard/revenue"
          className={({ isActive }) =>
            `${isActive ? "bg-btn-primary" : "bg-bgc-layer-semi-neutral"} flex items-center justify-center gap-1.5 rounded-[32px] px-3 py-1.5 backdrop-blur-[3.4px]`
          }
        >
          <span className="text-txt-primary text-xs leading-normal font-medium sm:text-base">
            Top Doanh thu
          </span>
        </NavLink>
        <NavLink
          to="/leaderboard/member"
          className={({ isActive }) =>
            `${isActive ? "bg-btn-primary" : "bg-bgc-layer-semi-neutral"} flex items-center justify-center gap-1.5 rounded-[32px] px-3 py-1.5 backdrop-blur-[3.4px]`
          }
        >
          <span className="text-txt-primary text-xs leading-normal font-medium sm:text-base">
            Top Thành viên
          </span>
        </NavLink>
      </div>

      {/* Title */}
      <h1 className="w-full text-center text-4xl leading-10 font-semibold">
        TOP THÀNH VIÊN
      </h1>

      {/* Top 3 Members */}
      {top3Users.length > 0 && (
        <div className="hidden w-full flex-row items-center justify-center overflow-x-auto lg:flex">
          {/* #2 */}
          {top3Users[1] && (
            <div className="relative m-8">
              <LeaderboardTopUser
                user={top3Users[1]}
                rank={2}
                gradientStyle="bg-[radial-gradient(ellipse_125.31%_134.25%_at_9.92%_4.55%,_rgba(234.16,_234.16,_234.16,_0.30)_0%,_rgba(42.91,_42.79,_42.08,_0.30)_69%)]"
                borderColor="outline-gray-400"
                shadowColor="shadow-[0px_0px_44.20000076293945px_0px_rgba(163,175,186,0.22)]"
              />
              <div className="absolute top-0 left-0 flex -translate-1/2 items-center justify-center">
                <img
                  src="/images/leaderboard/2.svg"
                  alt="Rank 2"
                  className="h-14 w-auto"
                />
              </div>
            </div>
          )}

          {/* #1 */}
          {top3Users[0] && (
            <div className="relative m-8">
              <LeaderboardTopUser
                user={top3Users[0]}
                rank={1}
                gradientStyle="bg-[radial-gradient(ellipse_125.31%_134.25%_at_9.92%_4.55%,_rgba(255,_224.67,_51.49,_0.30)_0%,_rgba(34.33,_30.05,_5.61,_0.30)_69%)]"
                borderColor="outline-yellow-300"
                shadowColor="shadow-[0px_0px_44.20000076293945px_0px_rgba(255,225,51,0.22)]"
              />
              <div className="absolute top-0 left-0 flex -translate-1/2 items-center justify-center">
                <img
                  src="/images/leaderboard/1.svg"
                  alt="Rank 1"
                  className="h-14 w-auto"
                />
              </div>
            </div>
          )}

          {/* #3 */}
          {top3Users[2] && (
            <div className="relative m-8">
              <LeaderboardTopUser
                user={top3Users[2]}
                rank={3}
                gradientStyle="bg-[radial-gradient(ellipse_125.31%_134.25%_at_9.92%_4.55%,_rgba(255,_112.54,_51.49,_0.30)_0%,_rgba(34.33,_12.31,_5.61,_0.30)_69%)]"
                borderColor="outline-red-400"
                shadowColor="shadow-[0px_0px_44.20000076293945px_0px_rgba(255,225,51,0.22)]"
              />
              <div className="absolute top-0 left-0 flex -translate-1/2 items-center justify-center">
                <img
                  src="/images/leaderboard/3.svg"
                  alt="Rank 3"
                  className="h-14 w-auto"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {top3Users.length > 0 && (
        <div className="flex w-full flex-col items-center justify-center overflow-x-auto lg:hidden">
          {/* #1 */}
          {top3Users[0] && (
            <div className="relative m-8">
              <LeaderboardTopUser
                user={top3Users[0]}
                rank={1}
                gradientStyle="bg-[radial-gradient(ellipse_125.31%_134.25%_at_9.92%_4.55%,_rgba(255,_224.67,_51.49,_0.30)_0%,_rgba(34.33,_30.05,_5.61,_0.30)_69%)]"
                borderColor="outline-yellow-300"
                shadowColor="shadow-[0px_0px_44.20000076293945px_0px_rgba(255,225,51,0.22)]"
              />
              <div className="absolute top-0 left-0 flex -translate-1/2 items-center justify-center">
                <img
                  src="/images/leaderboard/1.svg"
                  alt="Rank 1"
                  className="h-14 w-auto"
                />
              </div>
            </div>
          )}

          {/* #2 */}
          {top3Users[1] && (
            <div className="relative m-8">
              <LeaderboardTopUser
                user={top3Users[1]}
                rank={2}
                gradientStyle="bg-[radial-gradient(ellipse_125.31%_134.25%_at_9.92%_4.55%,_rgba(234.16,_234.16,_234.16,_0.30)_0%,_rgba(42.91,_42.79,_42.08,_0.30)_69%)]"
                borderColor="outline-gray-400"
                shadowColor="shadow-[0px_0px_44.20000076293945px_0px_rgba(163,175,186,0.22)]"
              />
              <div className="absolute top-0 left-0 flex -translate-1/2 items-center justify-center">
                <img
                  src="/images/leaderboard/2.svg"
                  alt="Rank 2"
                  className="h-14 w-auto"
                />
              </div>
            </div>
          )}

          {/* #3 */}
          {top3Users[2] && (
            <div className="relative m-8">
              <LeaderboardTopUser
                user={top3Users[2]}
                rank={3}
                gradientStyle="bg-[radial-gradient(ellipse_125.31%_134.25%_at_9.92%_4.55%,_rgba(255,_112.54,_51.49,_0.30)_0%,_rgba(34.33,_12.31,_5.61,_0.30)_69%)]"
                borderColor="outline-red-400"
                shadowColor="shadow-[0px_0px_44.20000076293945px_0px_rgba(255,225,51,0.22)]"
              />
              <div className="absolute top-0 left-0 flex -translate-1/2 items-center justify-center">
                <img
                  src="/images/leaderboard/3.svg"
                  alt="Rank 3"
                  className="h-14 w-auto"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Other Members List */}
      <div className="bg-bgc-layer1 border-bd-default w-full max-w-[750px] space-y-0 overflow-hidden rounded-2xl border p-0 py-4">
        {topUsers.map((user, index) => (
          <RatingItemUser key={user.id} user={user} index={index + 1} />
        ))}
      </div>
    </div>
  );
}
