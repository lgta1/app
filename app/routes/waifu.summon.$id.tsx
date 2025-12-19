import { Suspense, lazy, useEffect, useRef, useState } from "react";
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

import type { Route } from "./+types/waifu.summon.$id";

// LƯU Ý: Không import module chỉ chạy server ở top-level để tránh bị bundle vào client

const SummonHistoryDialog = lazy(() =>
  import("~/components/dialog-summon-history").then((m) => ({ default: m.SummonHistoryDialog }))
);
import { WaifuGuideDialog } from "~/components/dialog-waifu-guide";
import { DeviceRotationWarningDialog } from "~/components/dialog-warning-device-rotation";
import { LoadingSpinner } from "~/components/loading-spinner";
import SummonAssetPreloader from "~/components/summon-asset-preloader";
import { SummonDesktopButtons, SummonMobileButtons } from "~/components/summon-buttons";
import { SummonNavigationBar } from "~/components/summon-navigation-bar";
import { SummonResultOverlay } from "~/components/summon-result-overlay";
// Đã bỏ thanh overlay top-action; thay bằng pill ở thanh điều hướng
import { SummonVideoPlayer } from "~/components/summon-video-player";
import { SummonWaifuCards } from "~/components/summon-waifu-cards";
import { GOLD_COST_PER_SUMMON, GOLD_COST_PER_SUMMON_MULTI } from "~/constants/summon";
import { toastWarning } from "~/helpers/toast.helper";
import { WAIFU_SUMMON_SHARE_IMAGE } from "~/constants/share-images";

export function meta({ params }: Route.MetaArgs) {
  const origin = "https://vinahentai.com";
  const canonicalPath = params.id ? `/waifu/summon/${params.id}` : "/waifu/summon";
  const canonicalUrl = `${origin}${canonicalPath}`;
  const title = "VinaHentai – Triệu hồi Waifu";
  const description = "Triệu hồi waifu yêu thích, sưu tầm SSR và khoe thành tích cùng cộng đồng VinaHentai.";
  const image = WAIFU_SUMMON_SHARE_IMAGE;

  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: canonicalUrl },
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
    { name: "twitter:url", content: canonicalUrl },
  ];
}

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

  const openedBanners = bannersResult.data as any[];

    const navItems = openedBanners.map((banner, index) => ({
      label: "Banner thường",
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
  // Import động các module server-only bên trong action để tránh lọt vào client bundle
  const { requireLogin } = await import("@/services/auth.server");
  const { commitUserSession } = await import("@/services/session.svc");
  const { multiSummon, summon } = await import("@/services/summon.svc");
  const { incrementBannerRolls } = await import("@/mutations/banner.mutation");
  const { BannerModel } = await import("~/database/models/banner.model");
  const { PityCumulativeModel } = await import("~/database/models/pity-cumulative.model");
  const { UserModel } = await import("~/database/models/user.model");
  const { BusinessError } = await import("~/helpers/errors.helper");

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
  // Waifu list đã gộp vào dialog hướng dẫn

  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showSummonResult, setShowSummonResult] = useState(false);
  const [summonResult, setSummonResult] = useState<any>([]);
  const [runId, setRunId] = useState<number | null>(null);
  const [isSummoning, setIsSummoning] = useState(false);
  const [showSummonBackground, setShowSummonBackground] = useState(false);
  // ĐÃ GỠ flow claim milestone qua popover: các state milestoneToClaim, isClaimDialogOpen, pendingMilestone, simulateEnabled
  const [isPortrait, setIsPortrait] = useState(true);

  // Switch “bỏ qua video” (ghi nhớ localStorage)
  const [skipCinematic, setSkipCinematic] = useState(false);
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);

  const navigate = useNavigate();
  const submit = useSubmit();
  const actionData = useActionData<typeof action>();

  useEffect(() => {
    document.title = banner?.title
      ? `VinaHentai – Triệu hồi: ${banner.title}`
      : "VinaHentai – Triệu hồi Waifu";
  }, [banner?.title]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const audio = new Audio("/audio/music-nen.mp3");
    audio.loop = true;
    audio.volume = 0.35;
    backgroundAudioRef.current = audio;

    let hasUnlocked = false;
    let disposed = false;

    const events: Array<{ target: Window | Document; type: string }> = [
      { target: window, type: "pointerdown" },
      { target: window, type: "touchstart" },
      { target: window, type: "keydown" },
      { target: window, type: "scroll" },
    ];

    function detach() {
      events.forEach(({ target, type }) => target.removeEventListener(type, attemptPlay));
    }

    function attemptPlay() {
      if (hasUnlocked || disposed) return;
      audio
        .play()
        .then(() => {
          if (disposed) return;
          hasUnlocked = true;
          detach();
        })
        .catch(() => {
          // tiếp tục chờ tương tác của người dùng
        });
    }

    events.forEach(({ target, type }) => target.addEventListener(type, attemptPlay));
    attemptPlay();

    return () => {
      disposed = true;
      detach();
      audio.pause();
      audio.src = "";
      backgroundAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const v = localStorage.getItem("vh_skip_cinematic");
    setSkipCinematic(v === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("vh_skip_cinematic", skipCinematic ? "1" : "0");
  }, [skipCinematic]);
  // Gỡ bỏ hiệu lực query simulate (?simulate=1) vì không còn dùng simulate milestone.
  useEffect(() => {
    try {
      const mql = window.matchMedia("(orientation: portrait)");
      const apply = () => setIsPortrait(mql.matches);
      apply();
      mql.addEventListener("change", apply);
      return () => mql.removeEventListener("change", apply);
    } catch {}
  }, []);

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

    if (skipCinematic) {
      // Bỏ qua video nhưng vẫn hiển thị ảnh nền cinematic
      setIsVideoPlaying(false);
      setShowSummonBackground(true);
    } else {
      setShowSummonBackground(false);
      setIsVideoPlaying(true);
    }
  };

  useEffect(() => {
    if (!actionData) return;
    // Debugging: log server action response to help trace why items may not be
    // persisted into collection/leaderboard. Remove this after debugging.
    try {
      // eslint-disable-next-line no-console
      console.log("[summon] actionData:", actionData);
    } catch {}
    if (actionData?.success) {
      setSummonResult(actionData.data.items);
      // update runId so SummonResultOverlay remounts and forces images to load
      setRunId(Date.now());
      if (skipCinematic) setShowSummonResult(true);

      // ĐÃ GỠ: logic thu thập milestoneReached để bật dialog claim.
    } else if (actionData?.message) {
      toastWarning(actionData.message || "Có lỗi xảy ra, vui lòng tải lại trang");
    }
    setIsSummoning(false);
  }, [actionData, skipCinematic]);

  const handleVideoEnd = () => setShowSummonResult(true);

  const handleCloseSummonResult = () => {
    setShowSummonResult(false);
    setIsVideoPlaying(false);
    setShowSummonBackground(false);
    setSummonResult([]);
  };

  return (
    <div className="relative w-full">
      <Toaster position="bottom-right" />
      <SummonNavigationBar
        navItems={navItems}
        onGuideClick={() => setIsGuideDialogOpen(true)}
        onHistoryClick={() => setIsHistoryDialogOpen(true)}
        userGold={user?.gold}
      />

      {/* Desktop */}
      <BrowserView>
        <div className="relative w-full">
          <img
            src={banner?.imageUrl}
            alt={banner?.title}
            className="w-full object-cover"
          />
        </div>

        {/* Cụm thẻ + nút triệu hồi + switch (bên phải, không cần center) */}
        <div className="absolute right-8 bottom-8 flex w-auto min-w-[500px] flex-col items-start gap-3">
          <SummonWaifuCards waifuList={banner?.waifuList || []} />
          <SummonDesktopButtons isRateUp={banner?.isRateUp} onSummon={handleSummon} />

          {/* Switch bỏ qua video — nhỏ gọn, ngay dưới 2 nút */}
          <div className="mt-1 flex items-center gap-2 text-xs text-white">
            <button
              onClick={() => setSkipCinematic((v: boolean) => !v)}
              className="flex items-center gap-2"
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
            <span className="text-white/70">• Trải nghiệm thị giác tốt nhất khi xoay ngang màn hình</span>
          </div>
        </div>
      </BrowserView>

      {/* Mobile */}
      <MobileView>
        {isPortrait ? (
          // Portrait: banner ở giữa, 2 nút phía dưới, không che banner
          <div className="w-full flex flex-col items-center">
            {/* Đã bỏ thanh overlay top-action trên mobile portrait */}
            <div className="w-full flex justify-center">
              <img
                src={banner?.mobileImageUrl}
                alt={banner?.title}
                className="max-h-[55vh] w-auto object-contain"
              />
            </div>
            <div className="mt-3 w-full max-w-[460px] px-3 flex flex-col items-center gap-3">
              <SummonMobileButtons isRateUp={banner?.isRateUp} onSummon={handleSummon} />
              <div className="mt-1 flex items-center gap-2 text-xs text-white">
                <button
                  onClick={() => setSkipCinematic((v: boolean) => !v)}
                  className="flex items-center gap-2"
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
                <span className="text-white/70">• Trải nghiệm thị giác tốt nhất khi xoay ngang màn hình</span>
              </div>
            </div>
          </div>
        ) : (
          // Landscape: giữ layout cũ chồng nút lên ảnh để thao tác nhanh
          <>
            <div className="relative w-full">
              <img
                src={banner?.mobileImageUrl}
                alt={banner?.title}
                className="w-full object-cover"
              />
            </div>
            <div className="absolute bottom-9 left-1/2 flex w-[calc(100%-24px)] max-w-[460px] -translate-x-1/2 flex-col items-center gap-3">
              <SummonMobileButtons isRateUp={banner?.isRateUp} onSummon={handleSummon} />
              <div className="mt-1 flex items-center gap-2 text-xs text-white">
                <button
                  onClick={() => setSkipCinematic((v: boolean) => !v)}
                  className="flex items-center gap-2"
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
                <span className="text-white/70">• Trải nghiệm thị giác tốt nhất khi xoay ngang màn hình</span>
              </div>
            </div>
          </>
        )}
      </MobileView>

      {/* Video Player */}
      <SummonVideoPlayer
        isPlaying={isVideoPlaying}
        onVideoEnd={handleVideoEnd}
        forceShowBackground={showSummonBackground}
      />

      {/* Dev: simulate milestone (only when ?simulate=1) */}
      {/* ĐÃ GỠ: panel simulate milestone */}

      {/* Dialogs */}
  <WaifuGuideDialog open={isGuideDialogOpen} onOpenChange={setIsGuideDialogOpen} banner={banner} />
      <Suspense fallback={null}>
        {isHistoryDialogOpen && (
          <SummonHistoryDialog
            open={isHistoryDialogOpen}
            onOpenChange={setIsHistoryDialogOpen}
            currentSummons={user?.summonCount}
            bannerId={banner?.id}
          />
        )}
      </Suspense>
      {/* WaifuListDialog đã gộp vào WaifuGuideDialog */}
      <DeviceRotationWarningDialog />

      {/* Kết quả */}
      <SummonResultOverlay
        key={runId ?? "initial"}
        runId={runId}
        isVisible={showSummonResult}
        results={summonResult}
        onClose={handleCloseSummonResult}
        onRepeatMulti={() => {
          handleCloseSummonResult();
          setTimeout(() => {
            handleSummon("multi");
          }, 0);
        }}
      />

      {/* Preload video + background + card-back */}
      <SummonAssetPreloader />

      {/* Loading khi bỏ qua video và đang chờ kết quả */}
      {isSummoning && skipCinematic && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/60">
          <LoadingSpinner />
        </div>
      )}

      {/* ĐÃ GỠ: MilestoneClaimDialog (flow claim qua popover) */}
    </div>
  );
}
