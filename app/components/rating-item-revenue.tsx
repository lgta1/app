import { Banknote } from "lucide-react";

import type { MangaType } from "~/database/models/manga.model";

export default function RatingItemRevenue({
  manga,
  index,
}: {
  manga: MangaType;
  index: number;
}) {
  const color =
    (index === 1 && "text-[#FFE133]") ||
    (index === 2 && "text-[#5BD8FA]") ||
    (index === 3 && "text-[#FF7158]") ||
    "text-txt-primary";
  return (
    <div className="flex items-center gap-3 p-3">
      <span className={`w-5 text-center text-base font-semibold ${color}`}>{index}</span>
      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded">
        <img
          src={manga.poster}
          alt={manga.title}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex-1 space-y-1">
        <h3 className="text-txt-primary line-clamp-1 text-base leading-6 font-semibold">
          {manga.title}
        </h3>
        <div className="flex items-center justify-between">
          <div className="bg-bgc-layer-semi-purple rounded-full px-2 py-1.5 backdrop-blur-md">
            <span className="text-lav-500 line-clamp-1 text-xs font-medium">
              Chapter {manga.chapters}
            </span>
          </div>
          <div className="mr-2 flex items-center gap-1.5 backdrop-blur-md">
            <Banknote className="h-3 w-3 text-[#25eaac]" />
            <span className="text-xs font-medium text-[#25eaac]">
              {manga.revenue.toLocaleString("vi-VN")} VNĐ
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
