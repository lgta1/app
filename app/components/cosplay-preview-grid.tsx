import { Link } from "react-router-dom";

import type { MangaType } from "~/database/models/manga.model";
import { buildMangaUrl } from "~/utils/manga-url.utils";

interface CosplayPreviewGridProps {
  items: MangaType[];
}

export function CosplayPreviewGrid({ items }: CosplayPreviewGridProps) {
  if (!items || items.length === 0) {
    return null;
  }

  const displayItems = items.slice(0, 4);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative h-[15px] w-[15px]">
            <img src="/images/icons/multi-star.svg" alt="" className="absolute top-0 left-[4.62px] h-4" />
          </div>
          <h2 className="text-txt-primary text-xl font-semibold uppercase">Ảnh cosplay</h2>
        </div>
        <Link
          to="/genres/anh-cosplay"
          className="text-txt-secondary hidden text-sm font-semibold transition-colors hover:text-txt-primary md:inline-flex"
        >
          Xem tất cả →
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {displayItems.map((item) => (
          <Link
            key={item.id}
            to={buildMangaUrl(item as any)}
            className="group relative block overflow-hidden rounded-2xl"
          >
            <div className="relative w-full overflow-hidden rounded-2xl border border-white/5 aspect-[3/4]">
              <img
                src={item.poster}
                alt={item.title}
                className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-3 pt-6">
                <p className="text-sm font-semibold text-white line-clamp-2">{item.title}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-4 flex justify-center md:hidden">
        <a
          href="/genres/anh-cosplay"
          className="rounded-xl bg-btn-primary px-4 py-2 text-sm font-semibold text-bgc-layer1 hover:opacity-90 active:opacity-80"
        >
          Xem thêm
        </a>
      </div>

      <div className="mt-5 hidden justify-center md:flex">
        <a
          href="/genres/anh-cosplay"
          className="rounded-xl bg-btn-primary px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-bgc-layer1 hover:opacity-90 active:opacity-80"
        >
          Xem thêm
        </a>
      </div>
    </section>
  );
}

export default CosplayPreviewGrid;
