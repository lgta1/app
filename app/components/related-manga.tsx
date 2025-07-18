import { MangaCard } from "~/components/manga-card";
import type { MangaType } from "~/database/models/manga.model";

export default function RelatedManga({ mangaList }: { mangaList: MangaType[] }) {
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

      <div className="mt-6 flex flex-wrap gap-4">
        {mangaList?.map((manga) => <MangaCard key={manga.id} manga={manga} />)}
      </div>
    </section>
  );
}
