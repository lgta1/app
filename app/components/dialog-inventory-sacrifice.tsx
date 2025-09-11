"use client";

import * as React from "react";
import { toast } from "react-hot-toast";
import { useFetcher } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { Star, X } from "lucide-react";

interface WaifuSacrificeData {
  id: string;
  name: string;
  imageUrl: string;
  stars: number;
  quantity: number;
  status: "active" | "inactive";
  expBuff: number;
  goldBuff: number;
}

interface DialogInventorySacrificeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  waifu?: WaifuSacrificeData;
  onSetWaifu?: (waifuId: string) => void;
  onSacrificeSuccess?: () => void;
}

// Bảng quy đổi theo cấp sao
const SACRIFICE_RATES = {
  3: { exp: 50, gold: 10 },
  4: { exp: 200, gold: 15 },
  5: { exp: 1000, gold: 20 },
} as const;

export function DialogInventorySacrifice({
  open,
  onOpenChange,
  waifu,
  onSetWaifu,
  onSacrificeSuccess,
}: DialogInventorySacrificeProps) {
  const [sacrificeAmount, setSacrificeAmount] = React.useState(0);
  const fetcher = useFetcher();

  if (!waifu) return null;

  const maxSacrifice = Math.max(0, waifu.quantity - 1); // Không thể hiến tế hết

  // Tính toán EXP và Gold theo bảng quy đổi
  const waifuStars = waifu.stars as 3 | 4 | 5;
  const isValidStars = [3, 4, 5].includes(waifuStars);

  let expReward = 0;
  let goldCost = 0;

  if (isValidStars && sacrificeAmount > 0) {
    const rates = SACRIFICE_RATES[waifuStars];
    expReward = rates.exp * sacrificeAmount;
    goldCost = rates.gold * sacrificeAmount;
  }

  const handleSacrificeAmountChange = (value: number) => {
    const clampedValue = Math.min(Math.max(0, value), maxSacrifice);
    setSacrificeAmount(clampedValue);
  };

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    handleSacrificeAmountChange(value);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10) || 0;
    handleSacrificeAmountChange(value);
  };

  const handleSacrifice = () => {
    if (!isValidStars) {
      toast.error("Chỉ có thể hiến tế waifu 3, 4, 5 sao");
      return;
    }

    if (sacrificeAmount <= 0) {
      toast.error("Vui lòng chọn số lượng waifu để hiến tế");
      return;
    }

    const formData = new FormData();
    formData.append("waifuId", waifu.id);
    formData.append("sacrificeAmount", sacrificeAmount.toString());

    fetcher.submit(formData, {
      method: "POST",
      action: "/api/waifu/sacrifice",
    });

    setSacrificeAmount(0);
  };

  // Xử lý kết quả từ API
  React.useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.success) {
        toast.success(fetcher.data.message);
        onSacrificeSuccess?.();
        onOpenChange(false);
      } else {
        toast.error(fetcher.data.error || "Có lỗi xảy ra");
      }
    }
  }, [fetcher.data, onSacrificeSuccess, onOpenChange]);

  const isLoading = fetcher.state !== "idle";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          setSacrificeAmount(0);
        }
        onOpenChange(open);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-black/50" />
        <Dialog.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-[50%] left-[50%] z-50 w-[calc(100vw-32px)] translate-x-[-50%] translate-y-[-50%] lg:w-auto">
          <div className="border-bd-default bg-bgc-layer1 relative flex w-full flex-col gap-6 rounded-2xl border p-4 lg:max-w-[543px] lg:p-6">
            {/* Header với thông tin waifu */}
            <div className="flex flex-col gap-5 sm:flex-row sm:gap-5">
              {/* Waifu Image */}
              <div className="relative mx-auto w-32 flex-shrink-0 overflow-hidden rounded-lg sm:mx-0">
                {/* Placeholder image với background gradient */}
                <img
                  className="flex aspect-2/3 w-full items-center justify-center bg-gradient-to-b"
                  alt={waifu.name}
                  src={waifu.imageUrl}
                />

                <div className="absolute top-2 right-2 flex min-w-6 items-center justify-center gap-2.5 rounded-lg bg-black/30 p-1 backdrop-blur-[2px]">
                  <div className="justify-center text-xs leading-none font-bold text-white">
                    {waifu.quantity}
                  </div>
                </div>
              </div>

              {/* Waifu Info */}
              <div className="flex flex-1 flex-col gap-5">
                {/* Name & Stars */}
                <div className="flex justify-between pr-8">
                  <div className="flex flex-col">
                    <h3 className="text-txt-primary text-2xl leading-loose font-semibold">
                      {waifu.name}
                    </h3>

                    <div className="flex items-center">
                      {Array.from({ length: waifu.stars }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-[#FFD700] text-[#FFD700]" />
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col justify-center">
                    <button
                      onClick={() => onSetWaifu?.(waifu.id)}
                      className="rounded-xl px-4 py-3 text-sm font-semibold text-black transition-all duration-200 hover:scale-105"
                      style={{
                        background: "linear-gradient(to bottom, #DD94FF, #D373FF)",
                        boxShadow: "0px 4px 8.9px 0px rgba(196, 69, 255, 0.25)",
                      }}
                    >
                      Chọn Waifu đồng hành
                    </button>
                  </div>
                </div>
                {/* Stats */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <span className="text-txt-secondary w-28 text-base font-medium">
                      Số lượng:
                    </span>
                    <span className="text-txt-primary text-base font-medium">
                      {waifu.quantity}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-txt-secondary w-28 text-base font-medium">
                      Trạng thái:
                    </span>
                    <span className="text-success-success text-base font-medium">
                      {waifu.status === "active" ? "Đang đồng hành" : "Không hoạt động"}
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-bd-default h-px border-t" />

                {!!waifu.expBuff && (
                  <div className="text-sm">
                    <span className="text-txt-focus font-medium">Buff Kinh nghiệm: </span>
                    <span className="text-txt-primary font-medium">
                      Ngẫu nhiên thêm {waifu.expBuff}% EXP sau khi đọc 1 chapter truyện
                    </span>
                  </div>
                )}

                {!!waifu.goldBuff && (
                  <div className="text-sm">
                    <span className="text-txt-focus font-medium">Buff Dâm Ngọc: </span>
                    <span className="text-txt-primary font-medium">
                      Ngẫu nhiên thêm {waifu.goldBuff}% Ngọc sau khi đọc 1 chapter truyện
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Close Button */}
            <Dialog.Close className="text-txt-secondary hover:text-txt-primary absolute top-4 right-4 h-6 w-6 transition-colors">
              <X className="h-full w-full" />
            </Dialog.Close>

            {/* Sacrifice Section */}
            <div
              className="flex flex-col gap-4 rounded-2xl p-4"
              style={{ backgroundColor: "rgba(32, 38, 54, 0.56)" }}
            >
              {/* Title & Description */}
              <div className="flex flex-col gap-1">
                <h4 className="text-lg leading-7 font-semibold">
                  <span className="text-txt-primary">Hiến tế để nhận </span>
                  <span className="text-txt-focus">EXP</span>
                </h4>
                <p className="text-txt-secondary text-sm leading-tight font-medium">
                  {isValidStars
                    ? `Nếu số lượng Waifu lớn hơn 1, bạn có thể hiến tế để nhận kinh nghiệm. Tốn ${goldCost} Dâm Ngọc.`
                    : "Chỉ có thể hiến tế waifu 3, 4, 5 sao."}
                </p>
              </div>

              {/* Sacrifice rates info */}
              {isValidStars && (
                <div className="text-txt-secondary rounded-lg bg-black/20 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span>Tỷ lệ quy đổi ({waifuStars} sao):</span>
                    <span>
                      + {SACRIFICE_RATES[waifuStars].exp} EXP -{" "}
                      {SACRIFICE_RATES[waifuStars].gold} Vàng mỗi thẻ
                    </span>
                  </div>
                </div>
              )}

              {/* Slider & Button */}
              {isValidStars && maxSacrifice > 0 && (
                <div className="flex flex-col items-end gap-4 sm:flex-row">
                  {/* Slider Container */}
                  <div className="flex w-full flex-1 flex-col gap-4">
                    {/* Custom Slider */}
                    <div className="relative h-2.5 w-full">
                      {/* Background Track */}
                      <div className="bg-bgc-layer1 absolute top-1 h-[3px] w-full rounded-full" />

                      {/* Progress Track */}
                      <div
                        className="bg-lav-500 absolute top-1 h-[3px] rounded-full transition-all duration-200"
                        style={{ width: `${(sacrificeAmount / maxSacrifice) * 100}%` }}
                      />

                      {/* Thumb */}
                      <div
                        className="bg-lav-500 absolute h-2.5 w-2.5 rounded-full shadow-sm transition-all duration-200"
                        style={{
                          left: `${(sacrificeAmount / maxSacrifice) * 100}%`,
                          transform: "translateX(-50%)",
                        }}
                      />

                      {/* Invisible input for interaction */}
                      <input
                        type="range"
                        min="0"
                        max={maxSacrifice}
                        value={sacrificeAmount}
                        onChange={handleSliderChange}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        disabled={isLoading}
                      />
                    </div>

                    {/* Number Input */}
                    <div className="w-full">
                      <input
                        type="number"
                        min="0"
                        max={maxSacrifice}
                        value={sacrificeAmount}
                        onChange={handleInputChange}
                        disabled={isLoading}
                        className="bg-bgc-layer1 border-bd-default text-txt-primary focus:ring-lav-500 h-11 w-full rounded-xl border px-3 py-2.5 text-base font-medium focus:border-transparent focus:ring-2 focus:outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Sacrifice Button */}
                  <button
                    onClick={handleSacrifice}
                    disabled={sacrificeAmount === 0 || isLoading}
                    className="rounded-xl px-4 py-3 text-sm font-semibold text-black shadow-lg transition-all duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      background: "linear-gradient(to bottom, #DD94FF, #D373FF)",
                      boxShadow: "0px 4px 8.9px 0px rgba(196, 69, 255, 0.25)",
                    }}
                  >
                    {isLoading ? "Đang xử lý..." : "Hiến tế"}
                  </button>
                </div>
              )}

              {/* Reward Info */}
              {isValidStars && sacrificeAmount > 0 && (
                <div className="text-center text-base leading-normal font-medium">
                  <span className="text-txt-primary">Bạn sẽ nhận được </span>
                  <span className="text-txt-focus">{expReward.toLocaleString()} EXP</span>
                  <span className="text-txt-primary"> và tốn </span>
                  <span className="text-orange-400">
                    {goldCost.toLocaleString()} Dâm Ngọc
                  </span>
                </div>
              )}

              {/* No sacrifice available */}
              {(!isValidStars || maxSacrifice === 0) && (
                <div className="text-txt-secondary text-center text-sm">
                  {!isValidStars
                    ? "Waifu này không thể hiến tế (chỉ hỗ trợ 3-5 sao)"
                    : "Bạn cần có ít nhất 2 waifu cùng loại để hiến tế"}
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
