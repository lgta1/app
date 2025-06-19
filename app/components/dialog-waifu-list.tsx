import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import type { BannerType } from "~/database/models/banner.model";
import type { WaifuType } from "~/database/models/waifu.model";
import { formatDate } from "~/utils/date.utils";

interface WaifuListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  banner?: BannerType;
}

export function WaifuListDialog({ open, onOpenChange, banner }: WaifuListDialogProps) {
  // Group waifus by star rating
  const groupedWaifus =
    banner?.waifuList?.reduce(
      (acc, waifu) => {
        const stars = waifu.stars || 3;
        if (!acc[stars]) {
          acc[stars] = [];
        }
        acc[stars].push(waifu);
        return acc;
      },
      {} as Record<number, WaifuType[]>,
    ) || [];

  const WaifuCard = ({ waifu }: { waifu: WaifuType }) => (
    <div className="relative h-[211px] w-[141px] overflow-hidden rounded-lg bg-white">
      <img
        src={waifu.image || "/images/waifu/waifu-1.png"}
        alt={waifu.name}
        className="h-full w-full object-cover"
      />
    </div>
  );

  const WaifuSection = ({ stars, waifus }: { stars: number; waifus: WaifuType[] }) => (
    <div className="flex flex-col gap-4">
      <div className="text-txt-primary font-sans text-base leading-6 font-medium sm:text-lg">
        Waifu {stars} sao
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {waifus.map((waifu, index) => (
          <WaifuCard key={`waifu-${index}`} waifu={waifu} />
        ))}
      </div>
    </div>
  );

  const startDate = banner?.startDate || new Date();
  const endDate = banner?.endDate || new Date();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-full max-w-[90vw] -translate-x-1/2 -translate-y-1/2 transform overflow-auto sm:max-w-[678px]">
          <div className="bg-bgc-layer1 border-bd-default relative flex flex-col gap-6 rounded-2xl border p-4 sm:p-6">
            {/* Close Button */}
            <Dialog.Close className="text-txt-secondary hover:text-txt-primary absolute top-4 right-4 h-6 w-6 transition-colors sm:top-6 sm:right-6">
              <X className="h-6 w-6" />
            </Dialog.Close>

            {/* Header */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative flex flex-col items-center gap-1">
                <h1 className="text-txt-primary text-center font-sans text-2xl leading-9 font-semibold sm:text-3xl">
                  DANH SÁCH NHÂN VẬT
                </h1>
                <div className="text-txt-primary text-center font-sans text-base leading-7 font-semibold sm:text-xl">
                  {`(${formatDate(startDate)} - ${formatDate(endDate)})`}
                </div>
              </div>
              <div className="bg-txt-primary h-px w-full max-w-[370px]" />
            </div>

            {/* Content */}
            <div className="max-h-[calc(90vh-200px)] overflow-y-auto">
              <div className="flex flex-col gap-6">
                {/* 5 Star Section */}
                {groupedWaifus[5] && groupedWaifus[5].length > 0 && (
                  <WaifuSection stars={5} waifus={groupedWaifus[5]} />
                )}

                {/* 4 Star Section */}
                {groupedWaifus[4] && groupedWaifus[4].length > 0 && (
                  <WaifuSection stars={4} waifus={groupedWaifus[4]} />
                )}

                {/* 3 Star Section */}
                {groupedWaifus[3] && groupedWaifus[3].length > 0 && (
                  <WaifuSection stars={3} waifus={groupedWaifus[3]} />
                )}

                {/* Empty State */}
                {Object.keys(groupedWaifus).length === 0 && (
                  <div className="py-12 text-center">
                    <div className="text-txt-secondary font-sans text-base leading-6 font-medium">
                      Chưa có nhân vật nào trong danh sách
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
