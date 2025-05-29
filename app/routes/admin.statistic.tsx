import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { BookOpen, Eye } from "lucide-react";

import RatingItem from "~/components/rating-item";
import type { MangaType } from "~/database/models/manga.model";

interface StatisticData {
  totalManga: number;
  totalViews: number;
  topManga: MangaType[];
}

// Mock data cho demo - trong thực tế sẽ lấy từ database
const mockData: StatisticData = {
  totalManga: 70,
  totalViews: 7000000,
  topManga: [
    {
      id: "1",
      title: "Đã Chăm Rồi Thì Hãy Chịu Trách Nhiệm Đi!",
      description: "Description",
      poster: "https://placehold.co/56x56",
      chapters: 200,
      author: "Author",
      status: "ongoing",
      genres: ["romance"],
      likeNumber: 1000,
      viewNumber: 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "2",
      title: "Cuộc Sống Ở Clb Của Sinh Viên Năm Nhất Yul Moo",
      description: "Description",
      poster: "https://placehold.co/56x56",
      chapters: 200,
      author: "Author",
      status: "ongoing",
      genres: ["slice-of-life"],
      likeNumber: 1000,
      viewNumber: 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "3",
      title: "Người Anh Trai Mạnh Nhất Của Tôi Đã Mất Trí Nhớ",
      description: "Description",
      poster: "https://placehold.co/56x56",
      chapters: 200,
      author: "Author",
      status: "ongoing",
      genres: ["action"],
      likeNumber: 1000,
      viewNumber: 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
};

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  // Trong thực tế sẽ query database để lấy dữ liệu thống kê
  return Response.json(mockData);
}

type TabType = "manga" | "revenue" | "member";
type PeriodType = "month" | "week" | "day";

export default function AdminStatistic() {
  const data = useLoaderData<StatisticData>();
  const [activeTab, setActiveTab] = useState<TabType>("manga");
  const [activePeriod, setActivePeriod] = useState<PeriodType>("month");

  const tabs = [
    { key: "manga" as const, label: "Top Truyện tranh" },
    { key: "revenue" as const, label: "Top Doanh thu" },
    { key: "member" as const, label: "Top Thành viên" },
  ];

  const periods = [
    { key: "month" as const, label: "Top tháng" },
    { key: "week" as const, label: "Top tuần" },
    { key: "day" as const, label: "Top ngày" },
  ];

  const getTabTitle = () => {
    switch (activeTab) {
      case "manga":
        return "TOP TRUYỆN TRANH";
      case "revenue":
        return "TOP DOANH THU";
      case "member":
        return "TOP THÀNH VIÊN";
      default:
        return "TOP TRUYỆN TRANH";
    }
  };

  if (!data) {
    return <div>Loading...</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-[968px] flex-col items-center justify-center gap-6 p-4 md:p-6 lg:p-8">
      {/* Statistics Cards */}
      <div className="flex w-full max-w-[478px] flex-col items-start justify-start gap-6 md:flex-row">
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
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center justify-center gap-1.5 rounded-[32px] px-3 py-1.5 backdrop-blur-[3.40px] transition-colors ${
                activeTab === tab.key
                  ? "bg-btn-primary text-txt-primary"
                  : "bg-bgc-layer-semi-neutral text-txt-primary"
              }`}
            >
              <div className="font-sans text-base leading-normal font-medium">
                {tab.label}
              </div>
            </button>
          ))}
        </div>

        <div className="text-txt-primary w-full text-center font-sans text-2xl leading-10 font-semibold md:text-4xl">
          {getTabTitle()}
        </div>
      </div>

      {/* Ranking Table */}
      <div className="border-bd-default bg-bgc-layer1 flex w-full flex-col rounded-xl border">
        {/* Period Tabs */}
        <div className="border-bd-default flex w-full border-b">
          {periods.map((period) => (
            <button
              key={period.key}
              onClick={() => setActivePeriod(period.key)}
              className={`flex flex-1 items-center justify-center gap-2.5 p-3 transition-colors ${
                activePeriod === period.key
                  ? "border-lav-500 text-txt-primary border-b font-semibold"
                  : "text-txt-secondary font-medium"
              }`}
            >
              <div className="font-sans text-base leading-normal">{period.label}</div>
            </button>
          ))}
        </div>

        {/* Ranking List */}
        <div className="flex flex-col">
          {data.topManga.map((manga: MangaType, index: number) => (
            <div key={manga.id} className="border-bd-default border-b last:border-b-0">
              <RatingItem manga={manga} index={index + 1} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
