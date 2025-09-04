import { Link } from "react-router-dom";
import { ClockIcon } from "lucide-react";

import { type MangaType } from "~/database/models/manga.model";
import { formatDistanceToNow } from "~/utils/date.utils";

export function MangaCard({ manga }: { manga: MangaType }) {
  const { title, chapters, createdAt, poster } = manga;

  return (
    <Link to={`/manga/${manga.id}`} className="block aspect-2/3 w-full">
      <div className="relative h-full w-full overflow-hidden rounded-lg">
        {/* ?nh bìa */}
        <img
          src={poster}
          alt={title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />

        {/* Overlay: d?ch xu?ng sát dáy, 2 bên sát vi?n hon */}
        <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-1 pt-0.5">
          {/* Tiêu d?: full chi?u ngang, n?n den 55%, ôm sát ch? */}
          <h3 className="mb-1 leading-tight">
            <span className="block w-full truncate rounded-lg bg-black/55 px-2 py-0.5 text-sm font-semibold text-white leading-none backdrop-blur-[1px]">
              {title}
            </span>
          </h3>

          {/* Hàng nhãn 1 dòng: sát tiêu d? hon, sát dáy hon */}
          <div className="flex items-center gap-1.5">
            {/* Chap: nh?, n?n tím 55%, ôm sát ch? */}
            <span className="inline-block whitespace-nowrap rounded-full bg-violet-500/55 px-1.5 py-0.5 text-xs font-semibold text-white leading-none backdrop-blur-[1px]">
              Chap {chapters}
            </span>

            {/* Th?i gian: nh?, 1 dòng, n?n den 55%, icon tr?ng m? */}
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-black/55 px-1.5 py-0.5 text-xs text-white leading-none backdrop-blur-[1px]">
              <ClockIcon className="h-3.5 w-3.5 text-white/90" />
              {formatDistanceToNow(createdAt)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
