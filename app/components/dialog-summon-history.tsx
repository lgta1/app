import * as Dialog from "@radix-ui/react-dialog";
import { Info } from "lucide-react";

import { LoadingSpinner } from "~/components/loading-spinner";
import { Pagination } from "~/components/pagination";
import { GIFT_MILESTONES } from "~/constants/summon";
import type { UserWaifuType } from "~/database/models/user-waifu";
import { usePagination } from "~/hooks/use-pagination";

interface SummonHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSummons: number;
  bannerId?: string;
}

export function SummonHistoryDialog({
  open,
  onOpenChange,
  currentSummons,
  bannerId = "",
}: SummonHistoryDialogProps) {
  const {
    data: historyData,
    currentPage,
    totalPages,
    isLoading,
    error,
    goToPage,
  } = usePagination<UserWaifuType>({
    apiUrl: "/api/summon/history",
    limit: 5,
    queryParams: { bannerId },
  });

  const remainingSummons = GIFT_MILESTONES[GIFT_MILESTONES.length - 1] - currentSummons;

  const getTextColor = (waifuStars: number) => {
    if (waifuStars === 5) return "text-txt-focus";
    if (waifuStars === 4) return "text-txt-primary";
    return "text-txt-secondary";
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getRarityText = (stars: number) => {
    return `${stars} sao`;
  };

  const getProgressPercentage = () => {
    if (currentSummons < 100) return (currentSummons / 100) * 33;
    if (currentSummons < 200) return 33 + ((currentSummons - 100) / 100) * 33;
    if (currentSummons < 450) return 66 + ((currentSummons - 200) / 250) * 34;
    return 100;
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-full max-w-[615px] -translate-x-1/2 -translate-y-1/2 transform overflow-auto">
          <div className="bg-bgc-layer1 border-bd-default flex flex-col gap-6 rounded-2xl border p-4 sm:p-6">
            {/* Header */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-4">
                <h1 className="text-txt-primary text-center font-sans text-xl leading-9 font-semibold sm:text-3xl">
                  Lịch sử triệu hồi
                </h1>
                <div className="bg-txt-primary h-px w-full max-w-[370px]" />
              </div>

              {/* Progress Section */}
              <div className="flex flex-col gap-4">
                <div className="text-center">
                  <span className="text-txt-secondary font-sans text-base leading-6 font-medium">
                    Đạt các mốc sau để{" "}
                  </span>
                  <span className="text-txt-primary font-sans text-base leading-6 font-medium">
                    đảm bảo nhận Waifu 5 sao
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="relative">
                  <div className="bg-bgc-layer2 from-bgc-layer1 to-bgc-layer-semi-neutral absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-gradient-to-r">
                    <div
                      className="bg-btn-primary h-full rounded-full"
                      style={{
                        width: `${getProgressPercentage()}%`,
                      }}
                    />
                  </div>
                  <div className="relative flex items-center justify-between">
                    {GIFT_MILESTONES.map((milestone) => {
                      const isAchieved = currentSummons >= milestone;

                      return (
                        <div key={milestone} className="flex items-center">
                          {/* Milestone Circle */}
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full font-sans text-xs leading-4 font-medium ${
                              isAchieved
                                ? "bg-btn-primary text-txt-inverse"
                                : "bg-bgc-layer2 text-txt-primary"
                            }`}
                          >
                            {milestone}
                          </div>
                        </div>
                      );
                    })}
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
                        <span className="text-txt-focus font-sans text-base leading-6 font-medium">
                          Waifu 5 sao
                        </span>
                      </>
                    ) : (
                      <span className="text-txt-focus font-sans text-base leading-6 font-medium">
                        Đã đạt mốc nhận Waifu 5 sao!
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* History Table */}
            <div className="border-bd-default overflow-hidden rounded-lg border">
              {/* Table Header */}
              <div className="bg-bgc-layer2 border-bd-default grid grid-cols-3 border-b">
                <div className="border-bd-default border-r px-3 py-2">
                  <div className="text-txt-primary font-sans text-base leading-6 font-medium">
                    Thời gian
                  </div>
                </div>
                <div className="border-bd-default border-r px-3 py-2">
                  <div className="text-txt-primary font-sans text-base leading-6 font-medium">
                    Kết quả
                  </div>
                </div>
                <div className="px-3 py-2">
                  <div className="text-txt-primary font-sans text-base leading-6 font-medium">
                    Độ hiếm
                  </div>
                </div>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="py-8 text-center">
                  <div className="text-txt-secondary font-sans text-base leading-6 font-medium">
                    <LoadingSpinner />
                  </div>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="py-8 text-center">
                  <div className="font-sans text-base leading-6 font-medium text-red-500">
                    {error}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!isLoading && !error && historyData.length === 0 && (
                <div className="py-8 text-center">
                  <div className="text-txt-secondary font-sans text-base leading-6 font-medium">
                    Chưa có lịch sử triệu hồi
                  </div>
                </div>
              )}

              {/* Table Rows */}
              {!isLoading &&
                !error &&
                historyData.map((item) => (
                  <div
                    key={item.id}
                    className="border-bd-default grid grid-cols-3 border-b last:border-b-0"
                  >
                    <div className="border-bd-default flex flex-col gap-1 border-r px-3 py-2 sm:flex-row sm:items-center sm:gap-2">
                      <div
                        className={`font-sans text-sm leading-6 font-medium sm:text-base ${getTextColor(item.waifuStars)}`}
                      >
                        {formatDate(item.createdAt)}
                      </div>
                      <div
                        className={`font-sans text-sm leading-6 font-medium sm:text-base ${getTextColor(item.waifuStars)}`}
                      >
                        {formatTime(item.createdAt)}
                      </div>
                    </div>
                    <div className="border-bd-default border-r px-3 py-2">
                      <div
                        className={`font-sans text-sm leading-6 font-medium sm:text-base ${getTextColor(item.waifuStars)}`}
                      >
                        {item.waifuName}
                      </div>
                    </div>
                    <div className="px-3 py-2">
                      <div
                        className={`font-sans text-sm leading-6 font-medium sm:text-base ${getTextColor(item.waifuStars)}`}
                      >
                        {getRarityText(item.waifuStars)}
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex flex-col items-center justify-center self-stretch">
              {/* Pagination */}
              {!isLoading && !error && totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={goToPage}
                />
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
  );
}
