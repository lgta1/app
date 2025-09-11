import { Link } from "react-router-dom";
import * as Popover from "@radix-ui/react-popover";

import type { MangaType } from "~/database/models/manga.model";

interface SearchItemProps {
  manga: MangaType;
  isFirst?: boolean;
}

export function SearchItem({ manga, isFirst }: SearchItemProps) {
  return (
    <Popover.Close asChild>
      <Link
        to={`/manga/${manga.id}`}
        className={`hover:bg-bgc-layer2 flex items-center gap-3 p-3 transition-colors ${
          isFirst ? "bg-bgc-layer2" : "bg-bgc-layer1"
        } border-bd-default border-b last:border-b-0`}
      >
        <img
          src={manga.poster}
          alt={manga.title}
          className="h-[76px] w-[76px] flex-shrink-0 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-txt-primary line-clamp-1 text-base leading-6 font-semibold">
            {manga.title}
          </h3>
          <p className="text-txt-secondary text-xs leading-4 font-medium">
            {manga.genres.join(", ")}
          </p>
          <div className="bg-bgc-layer-semi-purple inline-flex items-center rounded-full px-2 py-1.5 backdrop-blur-[3.4px]">
            <span className="text-txt-focus text-xs leading-4 font-medium">
              Chapter {manga.chapters}
            </span>
          </div>
        </div>
      </Link>
    </Popover.Close>
  );
}
