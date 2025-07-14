import { useEffect, useState } from "react";
import { BrowserView, MobileView } from "react-device-detect";
import { Toaster } from "react-hot-toast";
import {
  type ActionFunctionArgs,
  type ClientLoaderFunctionArgs,
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
  useSubmit,
} from "react-router";

import { incrementBannerRolls } from "@/mutations/banner.mutation";
import { requireLogin } from "@/services/auth.server";
import { multiSummon, summon } from "@/services/summon.svc";

import { SummonHistoryDialog } from "~/components/dialog-summon-history";
import { WaifuGuideDialog } from "~/components/dialog-waifu-guide";
import { WaifuListDialog } from "~/components/dialog-waifu-list";
import { DeviceRotationWarningDialog } from "~/components/dialog-warning-device-rotation";
import { LoadingSpinner } from "~/components/loading-spinner";
import { SummonDesktopButtons, SummonMobileButtons } from "~/components/summon-buttons";
import { SummonNavigationBar } from "~/components/summon-navigation-bar";
import { SummonResultOverlay } from "~/components/summon-result-overlay";
import {
  SummonDesktopTopActionButtons,
  SummonMobileTopActionButtons,
} from "~/components/summon-top-action-buttons";
import { SummonVideoPlayer } from "~/components/summon-video-player";
import { SummonWaifuCards } from "~/components/summon-waifu-cards";
import { GOLD_COST_PER_SUMMON, GOLD_COST_PER_SUMMON_MULTI } from "~/constants/summon";
import type { BannerType } from "~/database/models/banner.model";
import { BannerModel } from "~/database/models/banner.model";
import { PityCumulativeModel } from "~/database/models/pity-cumulative.model";
import { UserModel } from "~/database/models/user.model";
import { BusinessError } from "~/helpers/errors.helper";
import { toastWarning } from "~/helpers/toast.helper";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const { id } = params;

  try {
    // Fetch opened banners from API
    const [bannersResponse, userResponse] = await Promise.all([
      fetch("/api/banners?type=opened"),
      fetch("/api/user"),
    ]);
    const [bannersResult, userResult] = await Promise.all([
      bannersResponse.json(),
      userResponse.json(),
    ]);

    if (!bannersResult.success || bannersResult.data?.length === 0) {
      throw redirect("/");
    }

    const openedBanners = bannersResult.data as BannerType[];

    const navItems = openedBanners.map((banner, index) => ({
      label: banner.isRateUp ? `Banner rate up ${index + 1}` : "Banner thường",
      to: `/waifu/summon/${banner.id}`,
      id: banner.id,
    }));

    navItems.push({
      label: "Bảng xếp hạng",
      to: "/waifu/leaderboard",
      id: "leaderboard",
    });

    const banner = openedBanners.find((banner) => banner.id === id);

    return { navItems, banner, user: userResult.data };
  } catch (error) {
    console.error("Error loading banners:", error);
    throw redirect("/");
  }
}

clientLoader.hydrate = true;

export function HydrateFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-txt-primary text-center">
        <LoadingSpinner />
      </div>
    </div>
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireLogin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as "single" | "multi";
  const bannerId = formData.get("bannerId") as string;

  if (!bannerId) {
    return Response.json({ message: "Banner ID is required" }, { status: 400 });
  }

  try {
    const cum = await PityCumulativeModel.findOne({ level: user.level }).lean();
    if (!cum) throw new BusinessError("Level không hợp lệ");

    const banner = await BannerModel.findOne({
      _id: bannerId,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).lean();
    if (!banner) throw new BusinessError("Banner không tồn tại");

    if (intent === "single") {
      const goldCost = banner.isRateUp
        ? GOLD_COST_PER_SUMMON.rateUp
        : GOLD_COST_PER_SUMMON.normal;
      const goldReduce = await UserModel.findOneAndUpdate(
        { _id: user.id, gold: { $gte: goldCost } },
        { $inc: { gold: -goldCost } },
        { new: true },
      );

      if (!goldReduce) throw new BusinessError("Không đủ vàng");
      await incrementBannerRolls(bannerId);

      const result = await summon(user, banner, cum);
      return {
        success: true,
        data: { type: "single", items: [result] },
        message: "Triệu hồi thành công",
      };
    } else if (intent === "multi") {
      const goldCost = banner.isRateUp
        ? GOLD_COST_PER_SUMMON_MULTI.rateUp
        : GOLD_COST_PER_SUMMON_MULTI.normal;
      const goldReduce = await UserModel.findOneAndUpdate(
        { _id: user.id, gold: { $gte: goldCost } },
        { $inc: { gold: -goldCost } },
        { new: true },
      );
      if (!goldReduce) throw new BusinessError("Không đủ vàng");
      await incrementBannerRolls(bannerId, 10);

      const result = await multiSummon(user, banner, cum, 10);
      return {
        success: true,
        data: { type: "multi", items: result },
        message: "Triệu hồi thành công",
      };
    }

    return Response.json({ message: "Hành động không hợp lệ" }, { status: 400 });
  } catch (error) {
    console.error("Summon error:", error);
    return Response.json(
      { message: "Có lỗi xảy ra vui lòng tải lại trang" },
      { status: 500 },
    );
  }
}

export default function WaifuSummon() {
  const { navItems, banner, user } = useLoaderData<typeof clientLoader>();
  const [isGuideDialogOpen, setIsGuideDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isWaifuListDialogOpen, setIsWaifuListDialogOpen] = useState(false);

  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showSummonResult, setShowSummonResult] = useState(false);
  const navigate = useNavigate();
  const submit = useSubmit();
  const [summonResult, setSummonResult] = useState<any>([]);
  const actionData = useActionData<typeof action>();

  const handleSummon = (type: "single" | "multi") => {
    if (!banner?.id) return;
    if (!user) {
      return navigate("/login");
    }

    if (type === "multi") {
      const goldCost = banner.isRateUp
        ? GOLD_COST_PER_SUMMON_MULTI.rateUp
        : GOLD_COST_PER_SUMMON_MULTI.normal;
      if (user.gold < goldCost) {
        return toastWarning("Không đủ dâm ngọc");
      }
    } else {
      const goldCost = banner.isRateUp
        ? GOLD_COST_PER_SUMMON.rateUp
        : GOLD_COST_PER_SUMMON.normal;
      if (user.gold < goldCost) {
        return toastWarning("Không đủ dâm ngọc");
      }
    }

    const formData = new FormData();
    formData.append("intent", type);
    formData.append("bannerId", banner.id);

    submit(formData, { method: "post" });
    setIsVideoPlaying(true);
  };

  useEffect(() => {
    if (actionData?.message) {
      if (actionData?.success) {
        setSummonResult(actionData.data.items);
      } else {
        toastWarning(actionData?.message || "Có lỗi xảy ra vui lòng tải lại trang");
      }
    }
  }, [actionData]);

  const handleVideoEnd = () => {
    setShowSummonResult(true);
  };

  const handleCloseSummonResult = () => {
    setShowSummonResult(false);
    setIsVideoPlaying(false);
    setSummonResult([]);
  };

  return (
    <div className="relative w-full">
      <Toaster position="bottom-right" />
      {/* Navigation Bar - chung cho cả mobile và desktop */}
      <SummonNavigationBar navItems={navItems} />

      {/* Desktop */}
      <BrowserView>
        <SummonDesktopTopActionButtons
          onGuideClick={() => setIsGuideDialogOpen(true)}
          onHistoryClick={() => setIsHistoryDialogOpen(true)}
          onWaifuListClick={() => setIsWaifuListDialogOpen(true)}
          user={user}
        />
        <div className="w-full">
          <img
            src={banner?.imageUrl}
            alt={banner?.title}
            className="w-full object-cover"
          />
        </div>
        <div className="absolute right-8 bottom-8 flex w-auto min-w-[500px] flex-col items-center justify-start gap-4">
          <SummonWaifuCards waifuList={banner?.waifuList || []} />
          <SummonDesktopButtons isRateUp={banner?.isRateUp} onSummon={handleSummon} />
        </div>
      </BrowserView>

      {/* Mobile */}
      <MobileView>
        <SummonMobileTopActionButtons
          onGuideClick={() => setIsGuideDialogOpen(true)}
          onHistoryClick={() => setIsHistoryDialogOpen(true)}
          onWaifuListClick={() => setIsWaifuListDialogOpen(true)}
          user={user}
        />
        <img
          src={banner?.mobileImageUrl}
          alt={banner?.title}
          className="w-full object-cover"
        />

        <div className="absolute right-6 bottom-9 flex w-auto flex-col items-center justify-start gap-3">
          <SummonMobileButtons isRateUp={banner?.isRateUp} onSummon={handleSummon} />
        </div>
      </MobileView>

      {/* Video Player */}
      <SummonVideoPlayer isPlaying={isVideoPlaying} onVideoEnd={handleVideoEnd} />

      {/* Guide Dialog */}
      <WaifuGuideDialog open={isGuideDialogOpen} onOpenChange={setIsGuideDialogOpen} />

      {/* History Dialog */}
      <SummonHistoryDialog
        open={isHistoryDialogOpen}
        onOpenChange={setIsHistoryDialogOpen}
        currentSummons={user?.summonCount}
        bannerId={banner?.id}
      />

      {/* Waifu List Dialog */}
      <WaifuListDialog
        open={isWaifuListDialogOpen}
        onOpenChange={setIsWaifuListDialogOpen}
        banner={banner}
      />

      {/* Device Rotation Warning Dialog */}
      <DeviceRotationWarningDialog />

      {/* Summon Result Overlay */}
      <SummonResultOverlay
        isVisible={showSummonResult}
        results={summonResult}
        onClose={handleCloseSummonResult}
      />
    </div>
  );
}
