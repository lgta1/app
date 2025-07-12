import { Link } from "react-router";
import { ClockIcon } from "lucide-react";

import type { MangaType } from "~/database/models/manga.model";
import { formatDistanceToNow } from "~/utils/date.utils";

export function TopBannerItem({ manga }: { manga: MangaType }) {
  return (
    <Link key={manga.id} to={`/manga/${manga.id}`} className="flex-shrink-0">
      <div
        className="relative h-[255px] w-[180px] overflow-hidden rounded-lg"
        style={{
          backgroundImage: `url(${manga.poster})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Hot Badge */}
        <div className="absolute top-2 left-2 z-10">
          <div className="flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-700 px-2.5 py-1 shadow-lg backdrop-blur-md">
            <span className="text-xs font-bold text-white">Hot</span>
          </div>
        </div>

        {/* Gradient overlay */}
        <div className="to-bgc-layer1 absolute inset-0 bg-gradient-to-b from-transparent from-40%"></div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 w-full px-2 py-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-txt-primary line-clamp-2 text-base font-semibold">
              {manga.title}
            </h2>
            <div className="flex items-center justify-between">
              <div className="bg-bgc-layer-semi-purple flex items-center justify-center rounded-full px-1.5 py-1 backdrop-blur-md">
                <span className="text-txt-focus line-clamp-1 text-[10px] font-medium">
                  Chương {manga.chapters}
                </span>
              </div>
              <div className="bg-bgc-layer-semi-neutral flex items-center justify-center gap-1 rounded-full px-1.5 py-1 backdrop-blur-md">
                <ClockIcon className="text-txt-primary h-3 w-3" />
                <span className="text-txt-primary line-clamp-1 text-[10px] font-medium">
                  {formatDistanceToNow(manga.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
