import * as Dialog from "@radix-ui/react-dialog";

interface WaifuGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WaifuGuideDialog({ open, onOpenChange }: WaifuGuideDialogProps) {
  const milestoneRewards: Array<{ threshold: number; reward: string }> = [
    { threshold: 50, reward: "50 vàng + 25 EXP" },
    { threshold: 100, reward: "100 vàng + 50 EXP" },
    { threshold: 200, reward: "200 vàng + 1 Waifu 4★" },
    { threshold: 450, reward: "🎁 Chắc chắn nhận 1 Waifu 5★ trong banner" },
  ];

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

              {/* Description & Banner Types */}
              <div className="w-full justify-center text-sm leading-normal sm:text-base">
                <div className="text-txt-secondary font-medium">
                  Chào mừng bạn đến với tính năng
                  <span className="text-txt-primary font-medium">Triệu Hồi Waifu</span> —
                  nơi bạn có thể sưu tầm những waifu xinh đẹp, quyến rũ và hiếm có đang
                  chờ được bạn triệu hồi về, để góp mặt trong dàn harem độc nhất vô nhị
                  của riêng bạn!
                </div>
                <div className="text-txt-secondary font-medium">
                  Hãy bắt đầu hành trình sưu tầm và mở rộng bộ sưu tập waifu mơ ước ngay
                  hôm nay!
                </div>
                <br />
                <div className="text-txt-primary mb-2 text-xl font-medium">
                  Phân Loại Banner
                </div>
                <ul className="text-txt-secondary list-disc space-y-2 pl-5 font-medium">
                  <li>
                    <span>Banner Thường</span>
                    <ul className="list-[circle] space-y-1 pl-5">
                      <li>
                        <span>1 lượt: </span>
                        <span className="text-txt-focus font-medium">
                          Tốn 10 Dâm Ngọc
                        </span>
                      </li>
                      <li>
                        <span>10 lượt: </span>
                        <span className="text-txt-focus font-medium">
                          Tốn 90 Dâm Ngọc
                        </span>
                      </li>
                      <li>
                        <span className="text-txt-focus font-medium">Lưu ý: </span> Các
                        lượt quay KHÔNG được tích lũy nhận thưởng.
                      </li>
                    </ul>
                  </li>
                  <li>
                    <span>Banner Rate Up</span>
                    <ul className="list-[circle] space-y-1 pl-5">
                      <li>
                        <span>1 lượt: </span>
                        <span className="text-txt-focus font-medium">
                          Tốn 15 Dâm Ngọc
                        </span>
                      </li>
                      <li>
                        <span>10 lượt: </span>
                        <span className="text-txt-focus font-medium">
                          Tốn 130 Dâm Ngọc
                        </span>
                      </li>
                      <li>
                        <span className="text-txt-focus font-medium">Đặc biệt: </span>
                        <span className="text-txt-secondary font-medium">
                          Khi quay banner Rate Up, lượt quay sẽ được tích lũy để nhận
                          thưởng theo các mốc dưới đây:
                        </span>
                      </li>
                    </ul>
                  </li>
                </ul>
              </div>

              {/* Milestone Rewards Title */}
              <div className="text-txt-primary w-full justify-center text-sm leading-normal font-medium sm:text-base">
                Mốc Quay Tích Lũy Banner Rate Up
              </div>

              {/* Milestone Rewards Table */}
              <div className="w-full flex-col items-start justify-start overflow-hidden">
                {/* Header */}
                <div className="bg-bgc-layer2 outline-bd-default flex w-full outline-1 outline-offset-[-1px]">
                  <div className="border-bd-default flex flex-[2] items-center justify-center gap-2.5 border-r px-2 py-2 sm:px-3">
                    <div className="text-txt-primary justify-center text-xs font-medium sm:text-base">
                      Mốc Quay Tích Lũy
                    </div>
                  </div>
                  <div className="flex flex-[3] items-center justify-center gap-2.5 px-2 py-2 sm:px-3">
                    <div className="text-txt-primary justify-center text-xs font-medium sm:text-base">
                      Phần Thưởng
                    </div>
                  </div>
                </div>

                {/* Data Rows */}
                {milestoneRewards.map((item) => (
                  <div
                    key={item.threshold}
                    className="border-bd-default outline-bd-default flex w-full border-b outline-1 outline-offset-[-1px]"
                  >
                    <div className="border-bd-default flex flex-[2] items-center justify-center gap-2.5 border-r px-2 py-2 sm:px-3">
                      <div className="text-txt-secondary justify-center text-xs font-medium sm:text-base">
                        {item.threshold} lượt
                      </div>
                    </div>
                    <div className="flex flex-[3] items-center justify-center gap-2.5 px-2 py-2 sm:px-3">
                      <div className="text-txt-secondary justify-center text-xs font-medium sm:text-base">
                        {item.reward}
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
