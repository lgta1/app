import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import * as Dialog from "@radix-ui/react-dialog";

import type { PityType } from "~/database/models/pity.model";

interface WaifuGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PityApiResponse = {
  success: boolean;
  data: PityType[];
  error?: string;
};

export function WaifuGuideDialog({ open, onOpenChange }: WaifuGuideDialogProps) {
  const fetcher = useFetcher<PityApiResponse>();
  const [pityData, setPityData] = useState<PityType[]>([]);

  useEffect(() => {
    if (open && !fetcher.data) {
      fetcher.load("/api/pity");
    }
  }, [open]);

  useEffect(() => {
    if (fetcher.data?.success) {
      setPityData(fetcher.data.data);
    }
  }, [fetcher.data]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-[50%] left-[50%] z-50 max-h-[90vh] w-[90vw] max-w-[615px] translate-x-[-50%] translate-y-[-50%] overflow-y-auto duration-200 sm:w-[615px]">
          <div className="bg-bgc-layer1 outline-bd-default inline-flex w-full flex-col items-center justify-center gap-6 rounded-2xl p-4 outline outline-offset-[-1px]">
            {/* Header */}
            <div className="flex w-full flex-col items-start justify-start gap-4">
              <div className="flex w-full flex-col items-center justify-start gap-4">
                <div className="text-txt-primary w-full text-center text-xl leading-9 font-semibold sm:text-3xl">
                  Hướng dẫn Triệu Hồi Waifu
                </div>
                <div className="h-0 w-24 outline-1 outline-offset-[-0.50px] outline-white/20 sm:w-96"></div>
              </div>

              {/* Introduction Text */}
              <div className="w-full justify-center text-sm leading-normal sm:text-base">
                <span className="text-txt-secondary font-medium">
                  Chào mừng đến với tính năng{" "}
                </span>
                <span className="text-txt-primary font-medium">Triệu Hồi Waifu</span>
                <span className="text-txt-secondary font-medium">
                  , nơi bạn có thể chiêu mộ những waifu xinh đẹp và mạnh mẽ để gia tăng
                  sức mạnh cho đội hình của mình! Để thực hiện Triệu Hồi, bạn cần sử dụng
                  Dâm Ngọc
                </span>
              </div>

              {/* How to Summon */}
              <div className="w-full justify-center text-sm leading-normal sm:text-base">
                <span className="text-txt-primary font-medium">
                  Cách thức Triệu Hồi:
                  <br />
                </span>
                <span className="text-txt-secondary font-medium">Triệu Hồi Đơn: Tốn</span>
                <span className="text-txt-focus font-medium"> 1 Dâm Ngọc</span>
                <span className="text-txt-secondary font-medium">
                  {" "}
                  cho một lần triệu hồi.
                  <br />
                  Triệu Hồi 10 lần: Tốn{" "}
                </span>
                <span className="text-txt-focus font-medium">10 Dâm Ngọc</span>
                <span className="text-txt-secondary font-medium">
                  {" "}
                  và đảm bảo nhận được ít nhất một waifu 4 sao
                </span>
              </div>

              {/* Rates Title */}
              <div className="text-txt-primary w-full justify-center text-sm leading-normal font-medium sm:text-base">
                Tỉ Lệ Triệu Hồi:
              </div>

              {/* Pity Table */}
              <div className="w-full flex-col items-start justify-start overflow-hidden">
                {/* Header */}
                <div className="bg-bgc-layer2 outline-bd-default flex w-full outline-1 outline-offset-[-1px]">
                  <div className="border-bd-default flex flex-1 items-center justify-center gap-2.5 border-r px-2 py-2 sm:px-3">
                    <div className="text-txt-primary justify-center text-xs font-medium sm:text-base">
                      %
                    </div>
                  </div>
                  <div className="border-bd-default flex flex-1 items-center justify-center gap-2.5 border-r px-2 py-2 sm:px-3">
                    <div className="text-txt-primary justify-center text-xs font-medium sm:text-base">
                      1 sao
                    </div>
                  </div>
                  <div className="border-bd-default flex flex-1 items-center justify-center gap-2.5 border-r px-2 py-2 sm:px-3">
                    <div className="text-txt-primary justify-center text-xs font-medium sm:text-base">
                      2 sao
                    </div>
                  </div>
                  <div className="border-bd-default flex flex-1 items-center justify-center gap-2.5 border-r px-2 py-2 sm:px-3">
                    <div className="text-txt-primary justify-center text-xs font-medium sm:text-base">
                      3 sao
                    </div>
                  </div>
                  <div className="border-bd-default flex flex-1 items-center justify-center gap-2.5 border-r px-2 py-2 sm:px-3">
                    <div className="text-txt-primary justify-center text-xs font-medium sm:text-base">
                      4 sao
                    </div>
                  </div>
                  <div className="border-bd-default flex flex-1 items-center justify-center gap-2.5 border-r px-2 py-2 sm:px-3">
                    <div className="text-txt-primary justify-center text-xs font-medium sm:text-base">
                      5 sao
                    </div>
                  </div>
                  <div className="flex flex-1 items-center justify-center gap-2.5 px-2 py-2 sm:px-3">
                    <div className="text-txt-primary justify-center text-xs font-medium sm:text-base">
                      Tổng
                    </div>
                  </div>
                </div>

                {/* Data Rows */}
                {pityData.map((row) => (
                  <div
                    key={row.id}
                    className="border-bd-default outline-bd-default flex w-full border-b outline-1 outline-offset-[-1px]"
                  >
                    <div className="border-bd-default flex flex-1 items-center justify-center gap-2.5 border-r px-2 py-2 sm:px-3">
                      <div className="text-txt-secondary justify-center text-xs font-medium sm:text-base">
                        {row.label}
                      </div>
                    </div>
                    <div className="border-bd-default flex flex-1 items-center justify-center gap-2.5 border-r px-2 py-2 sm:px-3">
                      <div className="text-txt-secondary justify-center text-xs font-medium sm:text-base">
                        {row.star1}
                      </div>
                    </div>
                    <div className="border-bd-default flex flex-1 items-center justify-center gap-2.5 border-r px-2 py-2 sm:px-3">
                      <div className="text-txt-secondary justify-center text-xs font-medium sm:text-base">
                        {row.star2}
                      </div>
                    </div>
                    <div className="border-bd-default flex flex-1 items-center justify-center gap-2.5 border-r px-2 py-2 sm:px-3">
                      <div className="text-txt-secondary justify-center text-xs font-medium sm:text-base">
                        {row.star3}
                      </div>
                    </div>
                    <div className="border-bd-default flex flex-1 items-center justify-center gap-2.5 border-r px-2 py-2 sm:px-3">
                      <div className="text-txt-secondary justify-center text-xs font-medium sm:text-base">
                        {row.star4}
                      </div>
                    </div>
                    <div className="border-bd-default flex flex-1 items-center justify-center gap-2.5 border-r px-2 py-2 sm:px-3">
                      <div className="text-txt-secondary justify-center text-xs font-medium sm:text-base">
                        {row.star5}
                      </div>
                    </div>
                    <div className="flex flex-1 items-center justify-center gap-2.5 px-2 py-2 sm:px-3">
                      <div className="text-txt-secondary justify-center text-xs font-medium sm:text-base">
                        {row.total}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="inline-flex w-full items-start justify-start gap-4">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="outline-lav-500 hover:bg-lav-500/5 flex flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-xl px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(146,53,190,0.25)] outline outline-offset-[-1px] transition-colors"
                >
                  <div className="text-txt-focus justify-center text-center text-sm leading-tight font-semibold">
                    Đóng
                  </div>
                </button>
              </Dialog.Close>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="flex flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-fuchsia-300 to-fuchsia-400 px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-colors hover:from-fuchsia-400 hover:to-fuchsia-500"
                >
                  <div className="justify-center text-center text-sm leading-tight font-semibold text-black">
                    Đã hiểu
                  </div>
                </button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
