import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { type LoaderFunctionArgs } from "react-router-dom";
import { useFetcher, useLoaderData } from "react-router-dom";
import { Briefcase } from "lucide-react";

import { requireLogin } from "@/services/auth.server";

import { DialogInventorySacrifice } from "~/components/dialog-inventory-sacrifice";
import { InventoryCard } from "~/components/inventory-card";
import InventoryDailyReward from "~/components/inventory-daily-reward";
import { Pagination } from "~/components/pagination";
import { ProfileInfo } from "~/components/profile-info";
import { UserModel } from "~/database/models/user.model";
import { UserFollowMangaModel } from "~/database/models/user-follow-manga.model";
import { UserReadChapterModel } from "~/database/models/user-read-chapter.model";
import { UserWaifuModel } from "~/database/models/user-waifu";
import { UserWaifuLeaderboardModel } from "~/database/models/user-waifu-leaderboard.model";
import type { WaifuType } from "~/database/models/waifu.model";
import { getMaxExp } from "~/helpers/user-level.helper";
import { useClientPagination } from "~/hooks/use-client-pagination";

export async function loader({ request }: LoaderFunctionArgs) {
  const userSession = await requireLogin(request);
  const userData = await UserModel.findById(userSession.id)
    .select(
      "name avatar createdAt level exp gold bio exp mangasCount faction gender currentWaifu",
    )
    .populate("currentWaifu")
    .lean();

  const maxExp = userData?.level === 9 ? "Tối đa" : getMaxExp(userData?.level || 1);

  const chaptersRead = await UserReadChapterModel.countDocuments({
    userId: userSession.id,
  });

  const mangasFollowing = await UserFollowMangaModel.countDocuments({
    userId: userSession.id,
  });

  const userWaifuLeaderboard = await UserWaifuLeaderboardModel.findOne({
    userId: userSession.id,
  })
    .select("waifuCollection totalWaifu")
    .lean();

  let waifuCollection =
    userWaifuLeaderboard?.waifuCollection.sort((a, b) => b.stars - a.stars) || [];

  waifuCollection = await Promise.all(
    waifuCollection.map(async (waifu) => {
      const waifuCount = await UserWaifuModel.countDocuments({
        userId: userSession.id,
        waifuId: waifu.waifuId,
      });

      return {
        ...waifu,
        count: waifuCount,
      };
    }),
  );

  const waifuCount = userWaifuLeaderboard?.totalWaifu || 0;

  return {
    ...userData,
    waifuCollection,
    waifuCount,
    chaptersRead,
    mangasFollowing,
    maxExp,
  };
}

export default function Inventory() {
  const user = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const ITEMS_PER_PAGE = 12;

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedWaifu, setSelectedWaifu] = useState<any>(null);

  const { paginatedItems, currentPage, totalPages, handlePageChange } =
    useClientPagination(user.waifuCollection, ITEMS_PER_PAGE);

  // Handle fetcher response
  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.success) {
        toast.success(fetcher.data.message);
      } else {
        toast.error(fetcher.data.error);
      }
    }
  }, [fetcher.data]);

  // Helper function to map waifu data to dialog format
  const mapWaifuToDialogFormat = (waifu: any) => {
    const currentWaifuId =
      typeof user.currentWaifu === "string"
        ? user.currentWaifu
        : (user.currentWaifu as any)?.id;

    return {
      id: waifu.waifuId,
      name: waifu.name,
      imageUrl: waifu.image,
      stars: waifu.stars,
      quantity: waifu.count,
      status: currentWaifuId === waifu.waifuId ? "active" : "inactive",
      goldBuff: waifu.goldBuff,
      expBuff: waifu.expBuff,
    };
  };

  const handleWaifuClick = (waifuId: string) => {
    const waifu = user.waifuCollection.find((w: any) => w.waifuId === waifuId);
    if (waifu) {
      setSelectedWaifu(mapWaifuToDialogFormat(waifu));
      setIsDialogOpen(true);
    }
  };

  const handleSetWaifu = (waifuId: string) => {
    if (user.currentWaifu) {
      toast.error("Bạn đã có waifu đồng hành rồi!");
      return;
    }

    const formData = new FormData();
    formData.append("actionType", "setWaifu");
    formData.append("waifuId", waifuId);

    fetcher.submit(formData, {
      method: "POST",
      action: "/api/user",
    });

    setIsDialogOpen(false);
  };

  const handleUnsetWaifu = () => {
    const formData = new FormData();
    formData.append("actionType", "unsetWaifu");

    fetcher.submit(formData, {
      method: "POST",
      action: "/api/user",
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-[968px] flex-col items-center gap-6 p-4 lg:py-8">
      <Toaster position="bottom-right" />
      <ProfileInfo user={user} />

      <InventoryDailyReward
        className="w-full"
        hasCurrentWaifu={!!user.currentWaifu}
        onUnsetWaifu={handleUnsetWaifu}
        currentWaifu={user.currentWaifu as unknown as WaifuType}
      />

      <div className="flex w-full flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Briefcase className="text-txt-focus h-5 w-5" />
          <h2 className="text-txt-primary font-sans text-xl font-semibold uppercase">
            túi đồ
          </h2>
        </div>

        <div className="flex flex-wrap gap-4 sm:gap-6 lg:gap-8">
          {paginatedItems.map((waifu: any, index) => (
            <InventoryCard
              index={(currentPage - 1) * ITEMS_PER_PAGE + index}
              key={(currentPage - 1) * ITEMS_PER_PAGE + index}
              image={waifu.image}
              className="cursor-pointer"
              onClick={() => handleWaifuClick(waifu.waifuId)}
              count={waifu.count}
            />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>

      {/* Dialog hiến tế */}
      {selectedWaifu && (
        <DialogInventorySacrifice
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          waifu={selectedWaifu}
          onSetWaifu={handleSetWaifu}
        />
      )}
    </div>
  );
}
