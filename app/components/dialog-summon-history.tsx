import * as Dialog from "@radix-ui/react-dialog";
import { Info, Gift, X, PackageOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { SummonCard } from "./summon-card";

import { LoadingSpinner } from "~/components/loading-spinner";
import { Pagination } from "~/components/pagination";
import { GIFT_MILESTONES, MILESTONE_REWARDS } from "~/constants/summon";
import type { UserWaifuType } from "~/database/models/user-waifu";
import { usePagination } from "~/hooks/use-pagination";
import toast from "react-hot-toast";

interface SummonHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSummons: number;
  bannerId?: string;
}

/* ====== THÊM: mốc hiển thị UI & mốc cuối để tính phần trăm ====== */
// Loại bỏ mốc 0 khỏi UI (đúng theo thiết kế)
const UI_MILESTONES = [...GIFT_MILESTONES]; // [50, 100, 200, 400]
const LAST_MILESTONE =
  GIFT_MILESTONES[GIFT_MILESTONES.length - 1] ?? 400; // mốc cuối cùng (400)

export function SummonHistoryDialog({
  open,
  onOpenChange,
  currentSummons,
  bannerId = "",
}: SummonHistoryDialogProps) {
  // Reveal overlay state
  const [isRevealOpen, setIsRevealOpen] = useState(false);
  const [revealItem, setRevealItem] = useState<{
    type: "waifu";
    itemStar: number;
    item: { image: string };
  } | null>(null);
  const [goldReward, setGoldReward] = useState<number | null>(null);
  const [cardRevealed, setCardRevealed] = useState(false);
  // Milestone interaction states
  const [claimingMilestone, setClaimingMilestone] = useState<number | null>(null);
  const [openingMilestone, setOpeningMilestone] = useState<number | null>(null); // bounce animation trigger

  const {
    data: historyData,
    currentPage,
    totalPages,
    isLoading,
    error,
    goToPage,
  } = usePagination<UserWaifuType>({
    apiUrl: "/api/summon/logs",
    limit: 5,
    queryParams: { bannerId },
  });

  const remainingSummons = GIFT_MILESTONES[GIFT_MILESTONES.length - 1] - currentSummons;
  const [claimed, setClaimed] = useState<number[]>([]);
  const [userGold, setUserGold] = useState<number>(0);
  const [goldBefore, setGoldBefore] = useState<number | null>(null);
  const [goldAward, setGoldAward] = useState<number | null>(null);
  const [goldAfter, setGoldAfter] = useState<number | null>(null);

  // Sync claimed milestones when dialog opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await fetch("/api/user");
        const json = await res.json().catch(() => null);
        if (json?.success && json?.data) {
          if (json.data.claimedMilestones) setClaimed(json.data.claimedMilestones || []);
          if (typeof json.data.gold === "number") setUserGold(json.data.gold);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Failed to fetch user claimed milestones", e);
      }
    })();
  }, [open]);

  const getTextColor = (waifuStars: number) => {
    if (waifuStars === 5) return "text-txt-focus";
    if (waifuStars === 4) return "text-txt-primary";
    return "text-txt-secondary";
  };

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const formatTime = (date: Date) =>
    new Date(date).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const getRarityText = (stars: number) => `${stars} sao`;

  const getProgressPercentage = () => {
    const n = Math.max(0, Number.isFinite(currentSummons) ? currentSummons : 0);
    if (LAST_MILESTONE <= 0) return 0;
    const pct = (n / LAST_MILESTONE) * 100;
    return Math.max(0, Math.min(100, pct));
  };

  // Claim milestone reward
  const claimMilestone = async (milestone: number) => {
    if (claimingMilestone) return;
    setClaimingMilestone(milestone);
    setOpeningMilestone(milestone);
    try {
      // Capture gold before claim for formula display
      setGoldBefore(userGold);
      const fd = new FormData();
      fd.append("milestone", String(milestone));
      fd.append("bannerId", bannerId);
      const res = await fetch("/api/waifu/milestone-claim", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = { _raw: text };
      }
      if (!res.ok || !json?.success) {
        const msg = json?.message || json?._raw || "Nhận thưởng thất bại";
        toast.error(msg);
        return;
      }
    setClaimed((s: number[]) => Array.from(new Set([...s, milestone])));
      const w = json?.data?.waifu;
      const updatedGold = json?.data?.gold;
      if (typeof updatedGold === "number") {
        // Compute reward gold from config (prefer config over diff to avoid race)
        const rewardCfg = MILESTONE_REWARDS[milestone as keyof typeof MILESTONE_REWARDS]?.gold ?? 0;
        setGoldAward(rewardCfg);
        setGoldAfter(updatedGold);
        // Infer before if not captured: updated - reward
        if (goldBefore === null) setGoldBefore(updatedGold - rewardCfg);
        setUserGold(updatedGold);
      }
      if (w && w.image && w.stars) {
        setRevealItem({ type: "waifu", itemStar: w.stars, item: { image: w.image } });
        setGoldReward(null);
        setCardRevealed(false);
        setIsRevealOpen(true);
      } else {
        setRevealItem(null);
        setGoldReward(MILESTONE_REWARDS[milestone as keyof typeof MILESTONE_REWARDS]?.gold ?? null);
        setIsRevealOpen(true);
      }
      toast.success(json.message || "Nhận thưởng thành công");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[SummonHistory] claim error", e);
      toast.error("Lỗi khi nhận thưởng");
    } finally {
      setClaimingMilestone(null);
      setTimeout(() => setOpeningMilestone(null), 700);
    }
  };

  return (
    <>
      {/* Khi overlay reveal đang mở, tạm thời đóng Dialog để bỏ focus trap và tránh chặn click */}
      <Dialog.Root open={open && !isRevealOpen} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className={`fixed inset-0 z-50 bg-black/50 ${isRevealOpen ? "pointer-events-none" : ""}`} />
          <Dialog.Content className={`fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-full max-w-[615px] -translate-x-1/2 -translate-y-1/2 transform overflow-auto`}>
            <div className="bg-bgc-layer1 border-bd-default flex flex-col gap-6 rounded-2xl border p-4 sm:p-6">
              {/* Header */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col items-center gap-4">
                  <h1 className="text-txt-primary text-center font-sans text-xl leading-9 font-semibold sm:text-3xl">
                    Lịch sử triệu hồi
                  </h1>
                  {/* Progress Bar + Milestones */}
                  <div className="relative mt-2 h-[120px] w-full">
                    {/* Base progress bar */}
                    <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-bgc-layer2" />
                    {/* Filled part */}
                    <div
                      className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#DD94FF] to-[#D373FF] shadow-[0_4px_10px_rgba(221,82,255,0.30)] transition-all"
                      style={{ width: `${getProgressPercentage()}%` }}
                    />
                    {/* Milestone gift boxes */}
                    {UI_MILESTONES.map((milestone) => {
                      const pct = (milestone / LAST_MILESTONE) * 100;
                      const isAchieved = currentSummons >= milestone;
                      const isClaimed = claimed.includes(milestone);
                      const isDisabled = !isAchieved || isClaimed || claimingMilestone === milestone;
                      return (
                        <div
                          key={`gift-${milestone}`}
                          className="absolute flex flex-col items-center"
                          style={{ left: `${pct}%`, transform: "translateX(-50%)", top: "calc(50% - 60px)" }}
                        >
                          <button
                            onClick={() => {
                              if (isDisabled) return;
                              claimMilestone(milestone);
                            }}
                            title={`${milestone} lượt`}
                            className={`relative flex h-10 w-10 items-center justify-center rounded-lg border border-transparent transition-all ${
                              isAchieved && !isClaimed
                                ? "bg-gradient-to-b from-[#FFD7A8] to-[#FFB86B] shadow-[0_6px_14px_rgba(255,184,107,0.24)]"
                                : isClaimed
                                ? "bg-bgc-layer2 opacity-60"
                                : "bg-bgc-layer2"
                            } ${claimingMilestone === milestone ? "opacity-60 cursor-wait" : ""} ${openingMilestone === milestone ? "animate-bounce" : ""}`}
                            disabled={isDisabled}
                          >
                            {isClaimed ? (
                              <PackageOpen className="h-5 w-5 text-txt-primary" />
                            ) : (
                              <Gift className={`h-5 w-5 ${isAchieved && !isClaimed ? "text-white" : "text-txt-primary"}`} />
                            )}
                            <div className="absolute -bottom-3 text-xs font-semibold text-txt-primary">{milestone}</div>
                          </button>
                        </div>
                      );
                    })}
                    {/* Current progress marker */}
                    <div
                      className="absolute flex flex-col items-center"
                      style={{ left: `${getProgressPercentage()}%`, transform: "translateX(-50%)", top: "calc(50% - 22px)" }}
                    >
                      <div className="h-8 w-1 rounded-sm bg-btn-primary shadow-[0_4px_10px_rgba(221,82,255,0.12)]" />
                      <div className="mt-1 text-center text-sm font-semibold text-txt-focus">{currentSummons}</div>
                    </div>
                  </div>
                  {/* Info Banner */}
                  <div className="bg-bgc-layer2 flex items-center gap-2.5 rounded-lg px-3 py-1.5">
                    <Info className="text-txt-secondary h-4 w-4 flex-shrink-0" />
                    <div className="flex-1 text-center">
                      {remainingSummons > 0 ? (
                        <>
                          <span className="text-txt-primary font-sans text-base leading-6 font-medium">
                            Còn {remainingSummons} lượt triệu hồi nữa để nhận{" "}
                          </span>
                          <span className="text-txt-focus font-sans text-base leading-6 font-medium">Waifu 5 sao</span>
                        </>
                      ) : (
                        <span className="text-txt-focus font-sans text-base leading-6 font-medium">Đã đạt mốc nhận Waifu 5 sao!</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* History Table */}
              <div className="border-bd-default overflow-hidden rounded-lg border">
                <div className="bg-bgc-layer2 border-bd-default grid grid-cols-3 border-b">
                  <div className="border-bd-default border-r px-3 py-2">
                    <div className="text-txt-primary font-sans text-base leading-6 font-medium">Thời gian</div>
                  </div>
                  <div className="border-bd-default border-r px-3 py-2">
                    <div className="text-txt-primary font-sans text-base leading-6 font-medium">Kết quả</div>
                  </div>
                  <div className="px-3 py-2">
                    <div className="text-txt-primary font-sans text-base leading-6 font-medium">Độ hiếm</div>
                  </div>
                </div>
                {isLoading && (
                  <div className="py-8 text-center">
                    <div className="text-txt-secondary font-sans text-base leading-6 font-medium">
                      <LoadingSpinner />
                    </div>
                  </div>
                )}
                {error && (
                  <div className="py-8 text-center">
                    <div className="font-sans text-base leading-6 font-medium text-red-500">{error}</div>
                    <div className="mt-2 text-xs font-sans leading-5 text-txt-secondary">
                      Nếu bạn dùng AdBlock / Privacy extension, hãy tạm tắt cho trang này rồi thử lại.
                    </div>
                  </div>
                )}
                {!isLoading && !error && historyData.length === 0 && (
                  <div className="py-8 text-center">
                    <div className="text-txt-secondary font-sans text-base leading-6 font-medium">Chưa có lịch sử triệu hồi</div>
                  </div>
                )}
                {!isLoading &&
                  !error &&
                  historyData.map((item) => (
                    <div key={item.id} className="border-bd-default grid grid-cols-3 border-b last:border-b-0">
                      <div className="border-bd-default flex flex-col gap-1 border-r px-3 py-2 sm:flex-row sm:items-center sm:gap-2">
                        <div className={`font-sans text-sm leading-6 font-medium sm:text-base ${getTextColor(item.waifuStars)}`}>{formatDate(item.createdAt)}</div>
                        <div className={`font-sans text-sm leading-6 font-medium sm:text-base ${getTextColor(item.waifuStars)}`}>{formatTime(item.createdAt)}</div>
                      </div>
                      <div className="border-bd-default border-r px-3 py-2">
                        <div className={`font-sans text-sm leading-6 font-medium sm:text-base ${getTextColor(item.waifuStars)}`}>{item.waifuName}</div>
                      </div>
                      <div className="px-3 py-2">
                        <div className={`font-sans text-sm leading-6 font-medium sm:text-base ${getTextColor(item.waifuStars)}`}>{getRarityText(item.waifuStars)}</div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Pagination */}
              <div className="flex flex-col items-center justify-center self-stretch">
                {!isLoading && !error && totalPages > 1 && (
                  <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} />
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-4 sm:flex-row">
                <button
                  onClick={() => onOpenChange(false)}
                  className="border-btn-primary text-txt-focus hover:bg-bgc-layer2 flex-1 rounded-xl border px-4 py-3 font-sans text-sm leading-5 font-semibold shadow-[0px_4px_8.9px_rgba(146,53,190,0.25)] transition-colors"
                >
                  Đóng
                </button>
                <button
                  onClick={() => onOpenChange(false)}
                  className="text-txt-inverse flex-1 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 font-sans text-sm leading-5 font-semibold shadow-[0px_4px_8.9px_rgba(195,68,255,0.25)] transition-opacity hover:opacity-90"
                >
                  Đã hiểu
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Reveal overlay */}
      {isRevealOpen && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4">
          {/* Overlay nền */}
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative z-10 flex w-full max-w-[720px] flex-col items-center gap-4">
            <button
              className="absolute right-2 top-2 rounded-md bg-white/10 p-1 text-white hover:bg-white/20"
              onClick={() => setIsRevealOpen(false)}
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
            {revealItem ? (
              <div className="flex flex-col items-center gap-4">
                <div className="text-white/90 text-base">Bấm vào thẻ để lật</div>
                <SummonCard
                  item={revealItem as any}
                  index={0}
                  size="large"
                  isRevealed={false}
                  onReveal={() => setCardRevealed(true)}
                  disableDropAnimation={true}
                />
                {cardRevealed && (
                  <button
                    onClick={() => setIsRevealOpen(false)}
                    className="to-lav-500 rounded-xl bg-gradient-to-b from-[#DD94FF] px-4 py-2 text-sm font-semibold text-black shadow-[0_4px_9px_rgba(196,69,255,0.25)] hover:from-[#e3a8ff]"
                  >
                    Xong
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-2xl bg-bgc-layer1/90 p-5 text-white shadow-xl outline outline-1 outline-white/10">
                <div className="text-lg font-semibold">Nhận thưởng</div>
                {goldBefore !== null && goldAward !== null && goldAfter !== null ? (
                  <div className="text-base font-medium">
                    <span className="text-white/80">{goldBefore}</span>
                    <span className="mx-1">+</span>
                    <span className="text-lime-300">{goldAward}</span>
                    <span className="mx-1">=</span>
                    <span className="text-txt-focus">{goldAfter}</span> Vàng
                  </div>
                ) : (
                  <div className="text-base">+{goldReward ?? 0} Vàng</div>
                )}
                <button
                  onClick={() => setIsRevealOpen(false)}
                  className="to-lav-500 rounded-xl bg-gradient-to-b from-[#DD94FF] px-4 py-2 text-sm font-semibold text-black shadow-[0_4px_9px_rgba(196,69,255,0.25)] hover:from-[#e3a8ff]"
                >
                  Xong
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
