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
import { commitUserSession } from "@/services/session.svc";
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
import SummonAssetPreloader from "~/components/summon-asset-preloader";
import { GOLD_COST_PER_SUMMON, GOLD_COST_PER_SUMMON_MULTI } from "~/constants/summon";
import type { BannerType } from "~/database/models/banner.model";
import { BannerModel } from "~/database/models/banner.model";
import { PityCumulativeModel } from "~/database/models/pity-cumulative.model";
import { UserModel } from "~/database/models/user.model";
import { BusinessError } from "~/helpers/errors.helper";
import { toastWarning } from "~/helpers/toast.helper";

/* =================== LOADER / ACTION =================== */

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const { id } = params;

  try {
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

    const banner = openedBanners.find((b) => b.id === id);

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
      if (!goldReduce) throw new BusinessError("Không đủ dâm ngọc");
      await incrementBannerRolls(bannerId);

      const result = await summon(user, banner, cum, request);
      const response = {
        success: true,
        data: { type: "single", items: [result] },
        message: "Triệu hồi thành công",
      };

      if (result.updatedSession) {
        return Response.json(response, {
          headers: { "Set-Cookie": await commitUserSession(result.updatedSession) },
        });
      }
      return response;
    }

    if (intent === "multi") {
      const goldCost = banner.isRateUp
        ? GOLD_COST_PER_SUMMON_MULTI.rateUp
        : GOLD_COST_PER_SUMMON_MULTI.normal;
      const goldReduce = await UserModel.findOneAndUpdate(
        { _id: user.id, gold: { $gte: goldCost } },
        { $inc: { gold: -goldCost } },
        { new: true },
      );
      if (!goldReduce) throw new BusinessError("Không đủ dâm ngọc");
      await incrementBannerRolls(bannerId, 10);

      const result = await multiSummon(user, banner, cum, 10, request);
      const response = {
        success: true,
        data: { type: "multi", items: result.items },
        message: "Triệu hồi thành công",
      };

      if (result.updatedSession) {
        return Response.json(response, {
          headers: { "Set-Cookie": await commitUserSession(result.updatedSession) },
        });
      }
      return response;
    }

    return Response.json({ message: "Hành động không hợp lệ" }, { status: 400 });
  } catch (error) {
    console.error("Summon error:", error);
    return Response.json(
      { message: "Có lỗi xảy ra, vui lòng tải lại trang" },
      { status: 500 },
    );
  }
}

/* =================== PAGE =================== */

export default function WaifuSummon() {
  const { navItems, banner, user } = useLoaderData<typeof clientLoader>();
  const [isGuideDialogOpen, setIsGuideDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isWaifuListDialogOpen, setIsWaifuListDialogOpen] = useState(false);

  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showSummonResult, setShowSummonResult] = useState(false);
  const [summonResult, setSummonResult] = useState<any>([]);
  const [isSummoning, setIsSummoning] = useState(false);

  // Switch “bỏ qua video” (ghi nhớ localStorage)
  const [skipCinematic, setSkipCinematic] = useState(false);

  const navigate = useNavigate();
  const submit = useSubmit();
  const actionData = useActionData<typeof action>();

  useEffect(() => {
    document.title = banner?.title
      ? `VinaHentai – Triệu hồi: ${banner.title}`
      : "VinaHentai – Triệu hồi Waifu";
  }, [banner?.title]);

  useEffect(() => {
    const v = localStorage.getItem("vh_skip_cinematic");
    setSkipCinematic(v === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("vh_skip_cinematic", skipCinematic ? "1" : "0");
  }, [skipCinematic]);

  const handleSummon = (type: "single" | "multi") => {
    if (!banner?.id) return;
    if (!user) return navigate("/login");

    if (type === "multi") {
      const cost = banner.isRateUp
        ? GOLD_COST_PER_SUMMON_MULTI.rateUp
        : GOLD_COST_PER_SUMMON_MULTI.normal;
      if (user.gold < cost) return toastWarning("Không đủ dâm ngọc");
    } else {
      const cost = banner.isRateUp
        ? GOLD_COST_PER_SUMMON.rateUp
        : GOLD_COST_PER_SUMMON.normal;
      if (user.gold < cost) return toastWarning("Không đủ dâm ngọc");
    }

    const formData = new FormData();
    formData.append("intent", type);
    formData.append("bannerId", banner.id);

    setIsSummoning(skipCinematic);
    submit(formData, { method: "post" });

    if (skipCinematic) setIsVideoPlaying(false);
    else setIsVideoPlaying(true);
  };

  useEffect(() => {
    if (!actionData) return;
    if (actionData?.success) {
      setSummonResult(actionData.data.items);
      if (skipCinematic) setShowSummonResult(true);
    } else if (actionData?.message) {
      toastWarning(actionData.message || "Có lỗi xảy ra, vui lòng tải lại trang");
    }
    setIsSummoning(false);
  }, [actionData, skipCinematic]);

  const handleVideoEnd = () => setShowSummonResult(true);

  const handleCloseSummonResult = () => {
    setShowSummonResult(false);
    setIsVideoPlaying(false);
    setSummonResult([]);
  };

  return (
    <div className="relative w-full">
      <Toaster position="bottom-right" />
      <SummonNavigationBar navItems={navItems} />

      {/* Desktop */}
      <BrowserView>
        <div className="relative w-full">
          <SummonDesktopTopActionButtons
            onGuideClick={() => setIsGuideDialogOpen(true)}
            onHistoryClick={() => setIsHistoryDialogOpen(true)}
            onWaifuListClick={() => setIsWaifuListDialogOpen(true)}
            user={user}
          />
          <img src={banner?.imageUrl} alt={banner?.title} className="w-full object-cover" />
        </div>

        {/* Cụm thẻ + nút triệu hồi + switch (bên phải, không cần center) */}
        <div className="absolute right-8 bottom-8 flex w-auto min-w-[500px] flex-col items-start gap-3">
          <SummonWaifuCards waifuList={banner?.waifuList || []} />
          <SummonDesktopButtons isRateUp={banner?.isRateUp} onSummon={handleSummon} />

          {/* Switch bỏ qua video — nhỏ gọn, ngay dưới 2 nút */}
          <button
            onClick={() => setSkipCinematic((v) => !v)}
            className="flex items-center gap-2 text-xs text-white mt-1"
            aria-pressed={skipCinematic}
          >
            <span>Bỏ qua video</span>
            <span
              className={[
                "relative inline-flex h-4 w-7 items-center rounded-full transition-colors",
                skipCinematic ? "bg-[#DD94FF]" : "bg-white/30",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                  skipCinematic ? "translate-x-3.5" : "translate-x-1",
                ].join(" ")}
              />
            </span>
          </button>
        </div>
      </BrowserView>

      {/* Mobile */}
      <MobileView>
        <div className="relative w-full">
          <SummonMobileTopActionButtons
            onGuideClick={() => setIsGuideDialogOpen(true)}
            onHistoryClick={() => setIsHistoryDialogOpen(true)}
            onWaifuListClick={() => setIsWaifuListDialogOpen(true)}
            user={user}
          />
          <img src={banner?.mobileImageUrl} alt={banner?.title} className="w-full object-cover" />
        </div>

        {/* 2 nút triệu hồi + switch (căn giữa theo cụm) */}
        <div className="absolute left-1/2 bottom-9 -translate-x-1/2 flex w-[calc(100%-24px)] max-w-[460px] flex-col items-center gap-3">
          <SummonMobileButtons isRateUp={banner?.isRateUp} onSummon={handleSummon} />

          <button
            onClick={() => setSkipCinematic((v) => !v)}
            className="flex items-center gap-2 text-xs text-white mt-1"
            aria-pressed={skipCinematic}
          >
            <span>Bỏ qua video</span>
            <span
              className={[
                "relative inline-flex h-4 w-7 items-center rounded-full transition-colors",
                skipCinematic ? "bg-[#DD94FF]" : "bg-white/30",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                  skipCinematic ? "translate-x-3.5" : "translate-x-1",
                ].join(" ")}
              />
            </span>
          </button>
        </div>
      </MobileView>

      {/* Video Player */}
      <SummonVideoPlayer isPlaying={isVideoPlaying} onVideoEnd={handleVideoEnd} />

      {/* Dialogs */}
      <WaifuGuideDialog open={isGuideDialogOpen} onOpenChange={setIsGuideDialogOpen} />
      <SummonHistoryDialog
        open={isHistoryDialogOpen}
        onOpenChange={setIsHistoryDialogOpen}
        currentSummons={user?.summonCount}
        bannerId={banner?.id}
      />
      <WaifuListDialog
        open={isWaifuListDialogOpen}
        onOpenChange={setIsWaifuListDialogOpen}
        banner={banner}
      />
      <DeviceRotationWarningDialog />

      {/* Kết quả */}
      <SummonResultOverlay
        isVisible={showSummonResult}
        results={summonResult}
        onClose={handleCloseSummonResult}
      />

      {/* Preload video + background + card-back */}
      <SummonAssetPreloader />

      {/* Loading khi bỏ qua video và đang chờ kết quả */}
      {isSummoning && skipCinematic && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/60">
          <LoadingSpinner />
        </div>
      )}
    </div>
  );
}
