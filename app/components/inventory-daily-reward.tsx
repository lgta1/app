import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useFetcher } from "react-router-dom";
import { Check, Gift, Heart, PlusCircle, Star } from "lucide-react";

import type { WaifuType } from "~/database/models/waifu.model";

interface DailyRewardProps {
  className?: string;
  currentWaifu: WaifuType;
  hasCurrentWaifu?: boolean;
  onUnsetWaifu?: () => void;
}

interface DailyRewardData {
  day: string;
  dayIndex: number;
  completed: boolean;
  reward: number;
  isToday: boolean;
  canClaim: boolean;
}

export default function InventoryDailyReward({
  className = "",
  hasCurrentWaifu = false,
  onUnsetWaifu,
  currentWaifu,
}: DailyRewardProps) {
  const fetcher = useFetcher();
  const [dailyRewards, setDailyRewards] = useState<DailyRewardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [claimed, setClaimed] = useState(false);
  const [messageText, setMessageText] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  // Helper to present probability distribution for the UI
  const getDistributionForStars = (stars: number | undefined) => {
    const s = stars ?? 3;
    if (s <= 3) {
      return [
        { value: 1, pct: 50 },
        { value: 2, pct: 40 },
        { value: 3, pct: 10 },
      ];
    }
    if (s === 4) {
      return [
        { value: 1, pct: 10 },
        { value: 2, pct: 30 },
        { value: 3, pct: 40 },
        { value: 4, pct: 20 },
      ];
    }
    return [
      { value: 1, pct: 0 },
      { value: 2, pct: 10 },
      { value: 3, pct: 20 },
      { value: 4, pct: 30 },
      { value: 5, pct: 20 },
      { value: 6, pct: 10 },
      { value: 7, pct: 5 },
      { value: 8, pct: 5 },
    ];
  };

  // Fetch daily checkin data khi component mount
  useEffect(() => {
    const fetchDailyData = async () => {
      try {
        const response = await fetch("/api/daily-checkin");
        const result = await response.json();

        if (result.success) {
          setDailyRewards(result.data.dailyRewards);
          // determine whether today's reward has been completed
          try {
            const today = result.data.dailyRewards.find((d: DailyRewardData) => d.isToday);
            setClaimed(!!today?.completed);
          } catch (e) {
            setClaimed(false);
          }
        } else {
          console.error("Error fetching daily rewards:", result.error);
        }
      } catch (error) {
        console.error("Error fetching daily rewards:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDailyData();
  }, []);

  // Xử lý check-in
  const handleCheckin = () => {
    if (!hasCurrentWaifu) {
      toast.error("Bạn cần có waifu đồng hành để nhận quà hàng ngày");
      return;
    }

    const formData = new FormData();
    formData.append("actionType", "checkin");

  // Optimistically mark claimed (button should grey out immediately) and start opening animation
  setClaimed(true);
  setOpening(true);
  // Show opening state; server will decide the real amount and return message
  setMessageText(`Đang mở quà...`);

    fetcher.submit(formData, {
      method: "POST",
      action: "/api/daily-checkin",
    });
  };

  // Cập nhật data sau khi check-in thành công
  useEffect(() => {
    if (fetcher.data?.success) {
      // Refresh data sau khi check-in thành công
      const fetchDailyData = async () => {
        try {
          const response = await fetch("/api/daily-checkin");
          const result = await response.json();

          if (result.success) {
            setDailyRewards(result.data.dailyRewards);
          }
        } catch (error) {
          console.error("Error fetching daily rewards:", error);
        }
      };

      fetchDailyData();
      // if server returned a message (with awarded amount), display it after a short "opening" animation
      if (fetcher.data?.message) {
        // keep the opening animation for a short time to simulate opening the gift
        setTimeout(() => {
          setMessageText(fetcher.data.message);
          setOpening(false);
        }, 800);
      } else {
        setOpening(false);
      }
    }

    if (fetcher.data?.error) {
      toast.error(fetcher.data.error);
      // if server-side error occurred, revert optimistic claim
      setClaimed(false);
    }

    if (fetcher.data?.message) {
      toast.success(fetcher.data.message);
    }
  }, [fetcher.data]);

  // Kiểm tra có thể check-in hôm nay không
  const canCheckinToday = dailyRewards.some((reward: DailyRewardData) => reward.canClaim);

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Gift className="text-txt-focus h-5 w-5" />
        <h2 className="text-txt-primary font-sans text-xl font-semibold uppercase">
          nhận thưởng cùng waifu
        </h2>
      </div>

      {/* Main Content */}
      <div className="h-auto w-full max-w-[968px] rounded-xl">
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2">
          {/* Waifu Section */}
          <div className="border-bd-default flex w-full flex-col gap-6 rounded-lg border bg-[radial-gradient(ellipse_100%_96.27%_at_50%_0%,_rgba(12,11,56,0.45)_0%,_black_77%)] p-4">
            <div className="flex items-center gap-3">
              <Heart className="text-txt-focus h-5 w-5" />
              <h3 className="text-txt-primary font-sans text-xl font-semibold uppercase">
                WAIFU ĐỒNG HÀNH
              </h3>
            </div>

            {hasCurrentWaifu ? (
              <div className="flex gap-4">
                {/* Waifu Image */}
                <div className="relative flex w-32 flex-shrink-0 flex-col gap-2 overflow-hidden rounded-lg">
                  <img
                    src={currentWaifu.image}
                    alt={currentWaifu.name}
                    className="aspect-2/3 w-full object-cover"
                  />

                  <button
                    onClick={onUnsetWaifu}
                    className="border-lav-500 text-txt-focus hover:bg-lav-500/10 w-full cursor-pointer self-start rounded-xl border px-4 py-1.5 text-xs font-semibold shadow-[0px_4px_8.9px_0px_rgba(146,53,190,0.25)] transition-colors"
                  >
                    Gỡ
                  </button>
                </div>

                {/* Waifu Info */}
                <div className="bg-bgc-layer2/75 flex flex-1 flex-col gap-2 rounded-xl p-3">
                  <div className="flex flex-col gap-1.5">
                    <h4 className="text-txt-primary text-2xl font-semibold">
                      {currentWaifu.name}
                    </h4>
                    <div className="flex items-center">
                      {Array.from({ length: currentWaifu.stars }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-[#FFD700] text-[#FFD700]" />
                      ))}
                    </div>
                  </div>

                  <div className="border-bd-default h-px border-t"></div>

                  {/* Removed buff display — buffs are no longer applied or shown */}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 self-stretch">
                {/* Placeholder Waifu Box */}
                <div className="border-bd-default bg-bgc-layer1 relative flex h-[180px] w-[100px] flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border sm:h-[200px] sm:w-[110px] lg:h-[221px] lg:w-[122px]">
                  <PlusCircle className="text-txt-tertiary h-12 w-12 sm:h-14 sm:w-14" />
                </div>

                {/* Text Message */}
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-sm leading-tight font-medium">
                    <span className="text-txt-secondary">
                      Vui lòng chọn Waifu mình yêu thích để nhận buff và mở khóa{" "}
                    </span>
                    <span className="text-txt-primary">Điểm danh hằng ngày</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Daily Check-in Section */}
          <div className="border-bd-default flex flex-1 flex-col gap-6 rounded-lg border bg-[radial-gradient(ellipse_100%_96.27%_at_50%_0%,_rgba(12,11,56,0.45)_0%,_black_77%)] p-4">
            <div className="flex items-center gap-3">
              <Gift className="text-txt-focus h-5 w-5" />
              <h3 className="text-txt-primary font-sans text-xl font-semibold uppercase">
                ĐIỂM DANH HẰNG NGÀY
              </h3>
            </div>

            <div className="bg-bgc-layer2/75 rounded-xl p-3">
              {/* Blur wrapper when no waifu */}
              <div
                className={`flex flex-1 flex-col gap-4 ${
                  hasCurrentWaifu ? "" : "blur-md"
                }`}
              >
                {/* Simple claim UI: single button + message (no multi-day calendar) */}
                <div className="flex items-center justify-between gap-2 sm:gap-4">
                  <div className="max-w-72">
                    <span className="text-txt-primary text-sm font-medium">
                      Nhấn nút để nhận thưởng hàng ngày.
                    </span>
                  </div>

                  <button
                    onClick={handleCheckin}
                    disabled={!hasCurrentWaifu || claimed}
                    className={`min-w-28 rounded-xl px-3 py-1.5 text-sm font-semibold shadow-[0px_4px_8.9px_0px_rgba(196,69,255,0.25)] transition-all ${
                      !hasCurrentWaifu || claimed
                        ? "cursor-not-allowed bg-gray-500 text-gray-300"
                        : "bg-gradient-to-b from-[#DD94FF] to-[#D373FF] text-black hover:from-[#E0A1FF] hover:to-[#D680FF]"
                    }`}
                  >
                    {fetcher.state !== "idle" ? (
                      "Đang xử lý..."
                    ) : claimed ? (
                      <span className="inline-flex items-center gap-2">
                        <Check className="h-4 w-4" />Đã nhận
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Gift className="h-5 w-5 text-yellow-300 animate-pulse" />
                        Nhận quà
                      </span>
                    )}
                  </button>
                </div>

                <div className="mt-4">
                  {messageText ? (
                    <div className="rounded-md bg-green-800/40 p-3 text-sm text-green-200">
                      {messageText}
                    </div>
                  ) : (
                    <p className="text-sm text-txt-secondary">
                      {hasCurrentWaifu
                        ? `Hàng ngày waifu đồng hành sẽ cố gắng kiếm dâm ngọc gửi cho bạn.`
                        : "Vui lòng chọn Waifu để nhận thưởng hàng ngày."}
                    </p>
                  )}

                  {/* Probability breakdown */}
                  {hasCurrentWaifu && (
                    <div className="mt-3 rounded-md border border-gray-700 bg-bgc-layer1/60 p-3 text-sm">
                      <div className="mb-2 font-semibold">Tỉ lệ nhận theo sao của waifu:</div>
                      <ul className="grid grid-cols-2 gap-1">
                        {getDistributionForStars(currentWaifu?.stars).map((d) => (
                          <li key={d.value} className="flex justify-between">
                            <span>{d.value} dâm ngọc</span>
                            <span className="text-txt-secondary">{d.pct}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
