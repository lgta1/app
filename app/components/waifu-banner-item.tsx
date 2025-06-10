import { Edit3, Trash2 } from "lucide-react";

import { type BannerType } from "~/database/models/banner.model";
import { getBannerStatus } from "~/helpers/banner.helper";
import { formatDate, formatTimeRemaining } from "~/utils/date.utils";

interface WaifuBannerItemProps {
  banner: BannerType;
}

export function WaifuBannerItem({ banner }: WaifuBannerItemProps) {
  // Calculate status from dates
  const status = getBannerStatus(new Date(banner.startDate), new Date(banner.endDate));

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "text-green-400";
      case "upcoming":
        return "text-yellow-300";
      case "ended":
        return "text-txt-tertiary";
      default:
        return "text-txt-secondary";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "running":
        return "Banner đang chạy...";
      case "upcoming":
        return "Banner sắp chạy";
      case "ended":
        return "Banner đã chạy";
      default:
        return "";
    }
  };

  const isEnded = status === "ended";

  return (
    <div className="bg-bgc-layer2 border-bd-default flex w-full flex-col items-start justify-between gap-4 rounded-2xl border p-4 md:flex-row md:items-end">
      <div className="flex flex-1 flex-col items-start justify-start gap-4 md:flex-row">
        <img
          className="h-32 w-full rounded-lg object-cover md:w-48"
          src={banner.imageUrl}
          alt={banner.title}
        />
        <div className="flex h-32 w-full flex-1 flex-col items-start justify-between gap-4 md:w-96">
          <div className="flex w-full flex-col items-start justify-start gap-1">
            <div
              className={`w-full font-sans text-base leading-normal font-semibold ${getStatusColor(status)}`}
            >
              {getStatusText(status)}
            </div>
            <div className="text-txt-primary w-full font-sans text-xl leading-7 font-semibold">
              {banner.title} ({formatDate(banner.startDate)} -{" "}
              {formatDate(banner.endDate)})
            </div>

            <div className="flex items-center justify-start gap-3.5">
              <div className="text-txt-secondary font-sans text-base leading-normal font-semibold">
                Thời gian còn lại
              </div>
              <div className="text-txt-secondary font-sans text-base leading-normal font-semibold">
                {formatTimeRemaining(banner.endDate)}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-start gap-3.5">
            <div className="text-txt-primary font-sans text-base leading-normal font-semibold">
              Tổng số lượt roll:
            </div>
            <div className="text-txt-primary font-sans text-base leading-normal font-semibold">
              {banner.totalRolls}
            </div>
          </div>
        </div>
      </div>

      {!isEnded && (
        <div className="flex items-center justify-start gap-2">
          <button className="hover:bg-bgc-layer-semi-neutral flex cursor-pointer items-center justify-center rounded-xl p-3 transition-colors">
            <Trash2 className="h-5 w-5 text-red-500" />
          </button>
          <button className="hover:bg-bgc-layer-semi-neutral flex cursor-pointer items-center justify-center rounded-xl p-3 transition-colors">
            <Edit3 className="h-5 w-5 text-green-400" />
          </button>
        </div>
      )}
    </div>
  );
}
