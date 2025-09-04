import { Link } from "react-router-dom";
import { ClockIcon, EyeIcon, HeartIcon } from "lucide-react";

import { type MangaType } from "~/database/models/manga.model";
import { formatDistanceToNow } from "~/utils/date.utils";

export function MangaCard({ manga }: { manga: MangaType }) {
  const { title, chapters, createdAt, viewNumber, likeNumber, poster } = manga;

  return (
    <Link to={`/manga/${manga.id}`} className="aspect-2/3 w-[46%] lg:w-[150px]">
      <div
        className="relative h-full w-full overflow-hidden rounded-lg"
        style={{
          backgroundImage: `url(${poster})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Gradient overlay */}
        <div className="to-bgc-layer1 absolute inset-0 bg-gradient-to-b from-transparent"></div>

        {/* View and Like counts - moved to top */}
        <div className="absolute top-2 left-1/2 flex w-full -translate-x-1/2 justify-between px-3">
          <div className="bg-bgc-layer-semi-neutral flex items-center gap-1.5 rounded-full px-1.5 py-1 backdrop-blur-md">
            <EyeIcon className="h-3 w-3" />
            <span className="text-txt-primary text-[10px] leading-none font-medium">
              {viewNumber?.toLocaleString()}
            </span>
          </div>
          <div className="bg-bgc-layer-semi-neutral flex items-center gap-1.5 rounded-full px-1.5 py-1 backdrop-blur-md">
            <HeartIcon className="h-3 w-3" />
            <span className="text-txt-primary text-[10px] leading-none font-medium">
              {likeNumber?.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Content - positioned at bottom with proper spacing */}
        <div className="absolute bottom-0 left-0 w-full px-2 pb-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-txt-primary opacity-80 text-xs leading-tight font-medium truncate whitespace-nowrap block w-full">
  {title}
</h3>
            <div className="flex items-center justify-between">
              <div className="bg-bgc-layer-semi-purple bg-opacity-80 flex items-center justify-center rounded-full px-1.5 py-1 backdrop-blur-sm">
                <span className="text-txt-focus line-clamp-1 text-[10px] leading-none font-medium">
                  Chap {chapters}
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
      </div>
    </Link>
  );
}
