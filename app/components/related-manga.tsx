import { MangaCard } from "~/components/manga-card";
import type { MangaType } from "~/database/models/manga.model";

export default function RelatedManga({ mangaList }: { mangaList: MangaType[] }) {
  // Lấy tối đa 6 truyện
  const items = (mangaList ?? []).slice(0, 6);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative h-[15px] w-[15px]">
            <img
              src="/images/icons/multi-star.svg"
              alt=""
              className="absolute top-0 left-[4.62px] h-4"
            />
          </div>
          <h2 className="text-txt-primary text-xl font-semibold uppercase">
            truyện liên quan
          </h2>
        </div>
      </div>

      {/* Mobile: 3 ô/1 hàng, kéo ngang (scroll-snap) + bóng mờ 2 mép */}
      <div className="relative -mx-4 mt-6 sm:hidden">
        {/* fade trái */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-white/90 to-transparent dark:from-neutral-900/90"
        />
        {/* fade phải */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-white/90 to-transparent dark:from-neutral-900/90"
        />

        <div
          className="grid snap-x snap-mandatory auto-cols-[33.333%] grid-flow-col overflow-x-auto px-4 [-webkit-overflow-scrolling:touch]"
          aria-label="Truyện liên quan (kéo ngang)"
        >
          {items.map((manga) => (
            <div
              key={manga.id}
              className="snap-start px-2"
              // px-2 tạo khoảng cách giữa các ô mà vẫn giữ đúng 3 ô/viewport
            >
              <MangaCard manga={manga} />
            </div>
          ))}
        </div>
      </div>

      {/* Tablet/Desktop: giữ grid cũ (3 cột tablet, 6 cột desktop) */}
      <div className="mt-6 hidden gap-4 sm:grid sm:grid-cols-3 lg:grid-cols-6">
        {items.map((manga) => (
          <div key={manga.id}>
            <MangaCard manga={manga} />
          </div>
        ))}
      </div>
    </section>
  );
}
