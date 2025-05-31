import type { LoaderFunctionArgs } from "react-router";
import { NavLink, useLoaderData } from "react-router";
import { BookOpen, Eye, Users } from "lucide-react";

import { getStatistic } from "@/queries/statistic.query";
import { getTopUser } from "@/queries/user.query";

import RatingItemUser from "~/components/rating-item-user";
import type { UserType } from "~/database/models/user.model";

interface StatisticData {
  totalMembers: number;
  totalManga: number;
  totalViews: number;
  topUser: UserType[];
}

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  const [statistic, topUser] = await Promise.all([getStatistic(), getTopUser()]);

  return Response.json({
    ...statistic,
    topUser,
  });
}

export default function AdminStatistic() {
  const data = useLoaderData<StatisticData>();

  const tabs = [
    { key: "manga" as const, label: "Top Truyện tranh" },
    { key: "member" as const, label: "Top Thành viên" },
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
          TOP THÀNH VIÊN
        </div>
      </div>

      {/* Top Users List */}
      <div className="border-bd-default bg-bgc-layer1 flex w-full flex-col rounded-xl border">
        <div className="flex flex-col space-y-0 py-4">
          {data.topUser.map((user: UserType, index: number) => (
            <RatingItemUser key={user.id} user={user} index={index + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}
