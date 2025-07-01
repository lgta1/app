import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useFetcher } from "react-router";
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

  // Fetch daily checkin data khi component mount
  useEffect(() => {
    const fetchDailyData = async () => {
      try {
        const response = await fetch("/api/daily-checkin");
        const result = await response.json();

        if (result.success) {
          setDailyRewards(result.data.dailyRewards);
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
    }

    if (fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }

    if (fetcher.data?.message) {
      toast.success(fetcher.data.message);
    }
  }, [fetcher.data]);

  // Kiểm tra có thể check-in hôm nay không
  const canCheckinToday = dailyRewards.some((reward) => reward.canClaim);

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
        <div className="flex flex-col gap-2.5 lg:flex-row">
          {/* Waifu Section */}
          <div className="border-bd-default flex w-full flex-col gap-6 rounded-lg border bg-[radial-gradient(ellipse_100%_96.27%_at_50%_0%,_rgba(12,11,56,0.45)_0%,_black_77%)] p-4 lg:w-96">
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
                    className="border-lav-500 text-txt-focus hover:bg-lav-500/10 w-full self-start rounded-xl border px-4 py-1.5 text-xs font-semibold shadow-[0px_4px_8.9px_0px_rgba(146,53,190,0.25)] transition-colors"
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

                  {!!currentWaifu.expBuff && (
                    <div className="text-sm">
                      <span className="text-txt-focus font-medium">
                        Buff Kinh nghiệm:{" "}
                      </span>
                      <span className="text-txt-primary font-medium">
                        Ngẫu nhiên thêm {currentWaifu.expBuff}% EXP sau khi đọc 1 chapter
                        truyện
                      </span>
                    </div>
                  )}

                  {!!currentWaifu.goldBuff && (
                    <div className="text-sm">
                      <span className="text-txt-focus font-medium">Buff Dâm Ngọc: </span>
                      <span className="text-txt-primary font-medium">
                        Ngẫu nhiên thêm {currentWaifu.goldBuff}% Ngọc sau khi đọc 1
                        chapter truyện
                      </span>
                    </div>
                  )}
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
                {/* Action Row */}
                <div className="flex items-center justify-between gap-2 sm:gap-4">
                  <div className="max-w-72">
                    <span className="text-txt-primary text-sm font-medium">
                      Điểm danh hàng ngày sẽ được kích hoạt khi bạn kích hoạt{" "}
                    </span>
                    <span className="text-txt-focus text-sm font-medium">
                      Đồng hành cùng Waifu
                    </span>
                  </div>
                  <button
                    onClick={handleCheckin}
                    disabled={!canCheckinToday || fetcher.state !== "idle"}
                    className={`min-w-28 rounded-xl px-3 py-1.5 text-sm font-semibold shadow-[0px_4px_8.9px_0px_rgba(196,69,255,0.25)] transition-all ${
                      canCheckinToday && fetcher.state === "idle"
                        ? "bg-gradient-to-b from-[#DD94FF] to-[#D373FF] text-black hover:from-[#E0A1FF] hover:to-[#D680FF]"
                        : "cursor-not-allowed bg-gray-500 text-gray-300"
                    }`}
                  >
                    {fetcher.state !== "idle"
                      ? "Đang xử lý..."
                      : canCheckinToday
                        ? "Nhận thưởng"
                        : "Nhận thưởng"}
                  </button>
                </div>

                {/* Calendar */}
                <div className="relative">
                  {/* Connecting Line Background */}
                  <div className="bg-txt-tertiary absolute top-[46px] right-[calc(50%/7)] left-[calc(50%/7)] h-[6px]"></div>

                  {/* Days Grid */}
                  <div className="grid grid-cols-7 gap-0">
                    {isLoading
                      ? // Loading skeleton
                        Array.from({ length: 7 }).map((_, index) => (
                          <div key={index} className="flex flex-col items-center gap-3">
                            <div className="h-6 w-12 animate-pulse rounded bg-gray-600"></div>
                            <div className="h-7 w-7 animate-pulse rounded-full bg-gray-600"></div>
                            <div className="h-5 w-8 animate-pulse rounded bg-gray-600"></div>
                          </div>
                        ))
                      : dailyRewards.map((item: DailyRewardData, index: number) => (
                          <div key={index} className="flex flex-col items-center gap-3">
                            {/* Day Label */}
                            <div className="flex h-6 items-center justify-center">
                              <span className="text-txt-secondary text-sm font-medium">
                                {item.day}
                              </span>
                            </div>

                            {/* Dot */}
                            <div className="bg-bgc-layer2 relative z-10 flex h-7 w-7 items-center justify-center rounded-full">
                              <div
                                className={`flex h-7 w-7 items-center justify-center rounded-full ${
                                  item.completed ? "bg-txt-focus" : "bg-txt-tertiary"
                                }`}
                              >
                                {item.completed && (
                                  <Check className="text-bgc-layer1 h-4 w-4" />
                                )}
                              </div>
                            </div>

                            {/* Reward */}
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center justify-center">
                                <img
                                  src="/images/icons/gold-icon.png"
                                  alt="gold"
                                  className="h-5 w-6"
                                />
                              </div>
                              <span className="text-txt-primary text-sm font-medium">
                                {item.reward}
                              </span>
                            </div>
                          </div>
                        ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
