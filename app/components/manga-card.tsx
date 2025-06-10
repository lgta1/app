import { ClockIcon, EyeIcon, HeartIcon } from "lucide-react";

import { type MangaType } from "~/database/models/manga.model";
import { formatDistanceToNow } from "~/utils/date.utils";

export function MangaCard({ manga }: { manga: MangaType }) {
  const { title, chapters, createdAt, viewNumber, likeNumber, poster } = manga;

  return (
    <div className="h-[225px] w-full">
      <div className="relative h-3/4 w-full overflow-hidden rounded-t-lg">
        <img src={poster} alt={title} className="h-full w-full object-cover" />
        <div className="to-bgc-layer1 absolute inset-0 bg-gradient-to-b from-transparent"></div>
        <div className="absolute bottom-2 left-1/2 flex w-full -translate-x-1/2 justify-between px-3">
          <div className="flex items-center gap-1.5 py-1.5">
            <EyeIcon className="h-3 w-3" />
            <span className="text-txt-primary text-[10px] leading-none font-medium">
              {viewNumber.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1.5 py-1.5">
            <HeartIcon className="h-3 w-3" />
            <span className="text-txt-primary text-[10px] leading-none font-medium">
              {likeNumber.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
      <div className="flex h-1/4 w-full flex-col justify-end">
        <div className="flex flex-1 items-center justify-start">
          <h3 className="text-txt-primary line-clamp-2 text-sm leading-normal font-semibold">
            {title}
          </h3>
        </div>
        <div className="flex items-center justify-between">
          <div className="bg-bgc-layer-semi-purple flex items-center justify-center rounded-full px-1.5 py-1 backdrop-blur-sm">
            <span className="text-txt-focus line-clamp-1 text-[10px] leading-none font-medium">
              Chương {chapters}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full backdrop-blur-sm">
            <ClockIcon className="text-txt-secondary h-3 w-3" />
            <span className="text-txt-secondary line-clamp-1 text-[10px] leading-none font-medium">
              {formatDistanceToNow(createdAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
