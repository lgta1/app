import { toast, Toaster } from "react-hot-toast";
import {
  type ClientActionFunctionArgs,
  Link,
  type MetaFunction,
  NavLink,
  useLoaderData,
  useSearchParams,
  useSubmit,
} from "react-router-dom";
import { Plus, Zap } from "lucide-react";

import { deleteBanner, resetSummon } from "@/mutations/banner.mutation";
import { countBanners, getAllBanners } from "@/queries/banner.query";

import { Pagination } from "~/components/pagination";
import { WaifuBannerItem } from "~/components/waifu-banner-item";
import type { BannerType } from "~/database/models/banner.model";

export const meta: MetaFunction = () => {
  return [
    { title: "Quản lý Banner | Admin" },
    { name: "description", content: "Trang quản lý banner hiển thị trong hệ thống" },
  ];
};

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = 10; // Số banner trên mỗi trang

  const [banners, totalBanners] = await Promise.all([
    getAllBanners(page, limit),
    countBanners(),
  ]);

  const totalPages = Math.ceil(totalBanners / limit);

  return Response.json({
    banners,
    pagination: {
      currentPage: page,
      totalPages,
      totalBanners,
    },
  });
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const bannerId = formData.get("bannerId");

  if (intent === "delete") {
    const result = await deleteBanner(request, bannerId as string);
    return result;
  }

  if (intent === "reset-summon") {
    await resetSummon();

    return Response.json({
      success: true,
      message: "Reset triệu hồi thành công",
    });
  }

  return Response.json({ message: "Thao tác không hợp lệ" }, { status: 400 });
}

export async function clientAction({ serverAction }: ClientActionFunctionArgs) {
  const actionData = await serverAction<typeof action>();
  if (actionData.success) {
    toast.success(actionData.message);
  } else {
    toast.error(actionData.message);
  }
}

export default function AdminWaifuBanner() {
  const { banners, pagination } = useLoaderData<{
    banners: BannerType[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalBanners: number;
    };
  }>();
  const [_, setSearchParams] = useSearchParams();
  const submit = useSubmit();

  const handlePageChange = (page: number) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("page", page.toString());
      return newParams;
    });
  };

  const handleDeleteBanner = (bannerId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa banner này không?")) {
      const formData = new FormData();
      formData.append("bannerId", bannerId);
      formData.append("intent", "delete");

      submit(formData, {
        method: "POST",
      });
    }
  };

  const handleResetSummon = () => {
    if (
      confirm(
        "Lưu ý: Triệu hồi sẽ được reset về 0 cho tất cả người dùng.\nChỉ nên làm điều này khi chạy banner mới!\nBạn có chắc chắn muốn reset triệu hồi không?",
      )
    ) {
      const formData = new FormData();
      formData.append("intent", "reset-summon");
      submit(formData, {
        method: "POST",
      });
    }
  };

  const tabs = [
    { key: "banner" as const, label: "Quản lý banner" },
    { key: "index" as const, label: "Quản lý waifu" },
    { key: "pity" as const, label: "Cài đặt" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[968px] flex-col items-center justify-center gap-6 p-4 md:p-6 lg:p-8">
      <Toaster position="bottom-right" />

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
          Quản lý banner
        </div>

        {/* Banner List Section */}
        <div className="flex w-full flex-col items-end justify-start gap-4">
          {/* Add Banner Button */}
          <div className="flex items-center gap-4">
            <button
              className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-[#C466FF] to-[#924DBF] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)]"
              onClick={handleResetSummon}
            >
              <Zap className="h-5 w-5 text-black" />
              <div className="text-center font-sans text-sm leading-tight font-semibold text-black">
                Reset triệu hồi
              </div>
            </button>

            <Link to="/admin/waifu/create-banner">
              <button className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-[#C466FF] to-[#924DBF] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)]">
                <Plus className="h-5 w-5 text-black" />
                <div className="text-center font-sans text-sm leading-tight font-semibold text-black">
                  Thêm banner
                </div>
              </button>
            </Link>
          </div>

          {/* Banner Items */}
          {banners.length > 0 ? (
            banners.map((banner, index) => (
              <WaifuBannerItem
                key={banner.id || `banner-${index}`}
                banner={banner}
                onDeleteBanner={() => handleDeleteBanner(banner.id)}
              />
            ))
          ) : (
            <div className="text-txt-secondary py-8 text-center">Chưa có banner nào</div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-6 flex w-full justify-center">
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
