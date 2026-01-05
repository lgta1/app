import { useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useFetcher, useLoaderData } from "react-router-dom";
import { Briefcase } from "lucide-react";
import type { LoaderFunctionArgs } from "react-router";

import { DialogInventorySacrifice } from "~/components/dialog-inventory-sacrifice";
import { InventoryCard } from "~/components/inventory-card";
import InventoryDailyReward from "~/components/inventory-daily-reward";
import { Pagination } from "~/components/pagination";
import { ProfileInfo } from "~/components/profile-info";
import type { WaifuType } from "~/database/models/waifu.model";
import { useClientPagination } from "~/hooks/use-client-pagination";

const ITEMS_PER_PAGE = 24;

export async function loader({ request }: LoaderFunctionArgs) {
  const [auth, userModelMod, userFollowMod, userReadMod, userWaifuMod, leaderboardMod, lvlMod, cdnMod, waifuImgMod] =
    await Promise.all([
      import("@/services/auth.server"),
      import("~/database/models/user.model"),
      import("~/database/models/user-follow-manga.model"),
      import("~/database/models/user-read-chapter.model"),
      import("~/database/models/user-waifu"),
      import("~/database/models/user-waifu-leaderboard.model"),
      import("~/helpers/user-level.helper"),
      import("~/.server/utils/cdn-url"),
      import("~/.server/utils/waifu-image"),
    ]);

  const userSession = await auth.requireLogin(request);
  const userData = await userModelMod.UserModel.findById(userSession.id)
    .select("name avatar createdAt level exp gold bio exp mangasCount faction gender currentWaifu")
    .populate("currentWaifu")
    .lean();

  if (userData && typeof (userData as any).avatar === "string") {
    (userData as any).avatar = cdnMod.rewriteLegacyCdnUrl((userData as any).avatar);
  }

  try {
    const cw: any = (userData as any)?.currentWaifu;
    if (cw && typeof cw === "object") {
      const nextImg = waifuImgMod.normalizeWaifuImageUrl(cw.image);
      if (nextImg) cw.image = nextImg;
    }
  } catch {
    // ignore
  }

  const maxExp = userData?.level === 9 ? "Tối đa" : lvlMod.getMaxExp(userData?.level || 1);
  const chaptersRead = await userReadMod.UserReadChapterModel.countDocuments({ userId: userSession.id });
  const mangasFollowing = await userFollowMod.UserFollowMangaModel.countDocuments({ userId: userSession.id });

  const userWaifuLeaderboard = await leaderboardMod.UserWaifuLeaderboardModel.findOne({ userId: userSession.id })
    .select("waifuCollection totalWaifu")
    .lean();

  let waifuCollection =
    userWaifuLeaderboard?.waifuCollection.sort((a: any, b: any) => (b?.stars || 0) - (a?.stars || 0)) || [];

  if (waifuCollection.length) {
    waifuCollection = waifuCollection.map((w: any) => {
      const nextImg = waifuImgMod.normalizeWaifuImageUrl(w?.image);
      return nextImg ? { ...w, image: nextImg } : w;
    });
  }

  waifuCollection = await Promise.all(
    waifuCollection.map(async (waifu: any) => {
      const waifuCount = await userWaifuMod.UserWaifuModel.countDocuments({
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
    ...(userData as any),
    waifuCollection,
    waifuCount,
    chaptersRead,
    mangasFollowing,
    maxExp,
  };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function Inventory() {
  const user = useLoaderData<LoaderData>() as any;
  const fetcher = useFetcher();

  const waifuList = useMemo(
    () => (Array.isArray(user?.waifuCollection) ? user.waifuCollection : []),
    [user?.waifuCollection],
  );

  const { currentPage, totalPages, paginatedItems, handlePageChange } =
    useClientPagination(waifuList, ITEMS_PER_PAGE);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedWaifu, setSelectedWaifu] = useState<any>(null);

  useEffect(() => {
    if (!fetcher.data) return;
    if ((fetcher.data as any).success) {
      toast.success((fetcher.data as any).message || "Thành công");
    } else {
      toast.error((fetcher.data as any).error || "Lỗi");
    }
  }, [fetcher.data]);

  const getWaifuId = (waifu: any) => waifu?.waifuId || waifu?.id || waifu?._id;

  const currentWaifuId = useMemo(() => {
    const cw: any = user?.currentWaifu;
    if (!cw) return null;
    if (typeof cw === "string") return cw;
    return cw?.id || cw?._id || cw?.waifuId || null;
  }, [user?.currentWaifu]);

  const mapWaifuToDialogFormat = (waifu: any) => {
    const waifuId = getWaifuId(waifu);
    return {
      id: String(waifuId),
      name: waifu.name,
      imageUrl: waifu.image,
      stars: Number(waifu.stars) || 0,
      quantity: waifu.count ?? waifu.quantity ?? 1,
      status: String(currentWaifuId) === String(waifuId) ? "active" : "inactive",
      expBuff: waifu.expBuff ?? 0,
      goldBuff: waifu.goldBuff ?? 0,
    };
  };

  const handleWaifuClick = (waifuId: string) => {
    const waifu = waifuList.find((w: any) => String(getWaifuId(w)) === String(waifuId));
    if (!waifu) return;
    setSelectedWaifu(mapWaifuToDialogFormat(waifu));
    setIsDialogOpen(true);
  };

  const handleSetWaifu = (waifuId: string) => {
    if (user?.currentWaifu) {
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

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) setSelectedWaifu(null);
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
        <div className="flex items-center gap-3">
          <Briefcase className="text-txt-focus h-5 w-5" />
          <h2 className="text-txt-primary font-sans text-xl font-semibold uppercase">túi đồ</h2>
        </div>

        <div className="flex flex-wrap gap-4 sm:gap-6 lg:gap-8">
          {paginatedItems.map((waifu: any, index: number) => (
            <InventoryCard
              index={(currentPage - 1) * ITEMS_PER_PAGE + index}
              key={(currentPage - 1) * ITEMS_PER_PAGE + index}
              image={waifu.image}
              className="cursor-pointer"
              onClick={() => handleWaifuClick(String(getWaifuId(waifu)))}
              count={waifu.count}
            />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
          </div>
        )}
      </div>

      {selectedWaifu && (
        <DialogInventorySacrifice
          open={isDialogOpen}
          onOpenChange={handleDialogOpenChange}
          waifu={selectedWaifu}
          onSetWaifu={handleSetWaifu}
        />
      )}
    </div>
  );
}
