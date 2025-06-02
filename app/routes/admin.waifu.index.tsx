import { useState } from "react";
import { Link, NavLink, useLoaderData } from "react-router";
import { Plus } from "lucide-react";

import { getAllWaifus } from "~/.server/queries/waifu.query";
import { WaifuItem } from "~/components/waifu-item";

export async function loader() {
  const waifus = await getAllWaifus();
  return { waifus };
}

type WaifuCategory = "5star" | "4star" | "3star" | "other";

export default function AdminWaifuIndex() {
  const { waifus } = useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState<WaifuCategory>("5star");

  const tabs = [
    { key: "banner" as const, label: "Quản lý banner" },
    { key: "index" as const, label: "Quản lý waifu" },
    { key: "pity" as const, label: "Cài đặt" },
  ];

  const waifuTabs = [
    { key: "5star" as const, label: "Waifu 5 sao" },
    { key: "4star" as const, label: "Waifu 4 sao" },
    { key: "3star" as const, label: "Waifu 3 sao" },
    { key: "other" as const, label: "Vật phẩm khác" },
  ];

  const filteredWaifus = waifus.filter((waifu) => {
    switch (activeTab) {
      case "5star":
        return waifu.stars === 5;
      case "4star":
        return waifu.stars === 4;
      case "3star":
        return waifu.stars === 3;
      case "other":
        return waifu.stars < 3;
      default:
        return true;
    }
  });

  const handleEdit = (id: string) => {
    console.log("Edit waifu:", id);
  };

  const handleDelete = (id: string) => {
    console.log("Delete waifu:", id);
  };

  // Chia waifu thành các hàng, mỗi hàng 3 item
  const waifuRows = [];
  for (let i = 0; i < filteredWaifus.length; i += 3) {
    waifuRows.push(filteredWaifus.slice(i, i + 3));
  }

  return (
    <div className="mx-auto flex w-full max-w-[1020px] flex-col items-center justify-center gap-6 p-4 md:p-6 lg:p-8">
      {/* Tab Selection and Title */}
      <div className="flex w-full flex-col items-center justify-start gap-6">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {tabs.map((tab) => (
            <NavLink
              to={`/admin/waifu/${tab.key}`}
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

        <div className="text-txt-primary w-full text-center font-sans text-2xl leading-10 font-semibold uppercase md:text-4xl">
          Quản lý waifu
        </div>

        <div className="flex w-full flex-col items-end justify-start gap-4">
          <Link to="/admin/waifu/create-waifu">
            <button className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-[#C466FF] to-[#924DBF] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)]">
              <Plus className="h-5 w-5 text-black" />
              <div className="text-center font-sans text-sm leading-tight font-semibold text-black">
                Thêm waifu
              </div>
            </button>
          </Link>
        </div>

        {/* Waifu List Section */}
        <div className="flex w-full max-w-[972px] flex-col items-start justify-start gap-4">
          {/* Waifu Category Tabs */}
          <div className="border-bd-default flex h-12 items-center justify-start self-stretch border-b">
            {waifuTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center justify-center gap-2.5 p-3 ${
                  activeTab === tab.key ? "border-lav-500 border-b" : ""
                }`}
              >
                <div
                  className={`justify-center font-sans text-base leading-normal ${
                    activeTab === tab.key
                      ? "text-txt-primary font-semibold"
                      : "text-txt-secondary font-medium"
                  }`}
                >
                  {tab.label}
                </div>
              </button>
            ))}
          </div>

          {/* Total Count */}
          <div className="text-txt-secondary justify-center font-sans text-base leading-normal font-medium">
            Tổng số: {filteredWaifus.length}
          </div>

          {/* Waifu Grid */}
          <div className="flex flex-col items-end justify-start gap-4 self-stretch">
            {waifuRows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className="grid grid-cols-1 gap-4 self-stretch md:grid-cols-3"
              >
                {row.map((waifu) => (
                  <WaifuItem
                    key={waifu.id}
                    {...waifu}
                    description={waifu.description || ""}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
