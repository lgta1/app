import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams } from "react-router-dom";

import { getAllGenres } from "@/queries/genres.query";
import { getTotalMangaCount, searchMangaApprovedWithPagination } from "@/queries/manga.query";
import { Dropdown } from "~/components/dropdown";
import { MangaCard } from "~/components/manga-card";
import { Pagination } from "~/components/pagination";
import { MANGA_CONTENT_TYPE, MANGA_STATUS, MANGA_USER_STATUS } from "~/constants/manga";
import type { GenresType } from "~/database/models/genres.model";
import type { MangaType } from "~/database/models/manga.model";

export const meta: MetaFunction = () => {
  return [
    { title: "Danh sách truyện | Vinahentai" },
    {
      name: "description",
      content: "Xem danh sách truyện đầy đủ, lọc theo trạng thái và sắp xếp.",
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { sharedTtlCache } = await import("~/.server/utils/ttl-cache");

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const sortParam = url.searchParams.get("sort") || "updatedAt"; // updatedAt | createdAt | oldest | views | az | za
  const statusParam = url.searchParams.get("status") || ""; // "completed,ongoing" etc
  const limit = 40;

  const cacheKey = `loader:danh-sach:page=${page}:sort=${sortParam}:status=${statusParam}`;
  return sharedTtlCache.getOrSet(cacheKey, 30_000, async () => {

  const statuses = new Set(statusParam.split(",").map((s) => s.trim()).filter(Boolean));

  const query: Record<string, any> = {
    status: MANGA_STATUS.APPROVED,
    contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
  };
  if (statuses.has("completed") && !statuses.has("ongoing")) {
    query.userStatus = MANGA_USER_STATUS.COMPLETED;
  } else if (statuses.has("ongoing") && !statuses.has("completed")) {
    query.userStatus = MANGA_USER_STATUS.ON_GOING;
  }

  // Map sort options
  let sort: Record<string, 1 | -1> | undefined;
  switch (sortParam) {
    case "createdAt":
      sort = { createdAt: -1 };
      break;
    case "oldest":
      sort = { updatedAt: 1 };
      break;
    case "views":
      sort = { viewNumber: -1 } as any;
      break;
    case "az":
      sort = { title: 1 } as any;
      break;
    case "za":
      sort = { title: -1 } as any;
      break;
    case "updatedAt":
    default:
      sort = { updatedAt: -1 };
      break;
  }

    const [genresList, manga, totalCount] = await Promise.all([
      sharedTtlCache.getOrSet("genres:all", 5 * 60 * 1000, () => getAllGenres()),
      searchMangaApprovedWithPagination({ page, limit, query, sort }),
      getTotalMangaCount({ query }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      genresList,
      manga,
      currentPage: page,
      totalPages,
      sort: sortParam,
      statusApplied: Array.from(statuses),
    };
  });
}

export default function DanhSachPage() {
  const { genresList, manga, currentPage, totalPages, sort, statusApplied } = useLoaderData<{
    genresList: GenresType[];
    manga: MangaType[];
    currentPage: number;
    totalPages: number;
    sort: string;
    statusApplied: string[];
  }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusSet = new Set(statusApplied);

  const toggleStatus = (key: "completed" | "ongoing") => {
    const next = new Set(statusSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    // Stage in URL immediately? We will apply on click "Lọc" below
  };

  const applyFilters = () => {
    // Rebuild from form controls in DOM for robustness
    const completed = (document.getElementById("f-status-completed") as HTMLInputElement | null)?.checked;
    const ongoing = (document.getElementById("f-status-ongoing") as HTMLInputElement | null)?.checked;
    setSearchParams((prev) => {
      const statuses: string[] = [];
      if (ongoing) statuses.push("ongoing");
      if (completed) statuses.push("completed");
      if (statuses.length) prev.set("status", statuses.join(","));
      else prev.delete("status");
      prev.set("page", "1");
      return prev;
    });
  };

  const handleSortChange = (value: string) => {
    setSearchParams((prev) => {
      prev.set("sort", value);
      prev.set("page", "1"); // Khi đổi bộ lọc: quay về trang 1
      return prev;
    });
  };

  const handlePageChange = (page: number) => {
    setSearchParams((prev) => {
      prev.set("page", String(page));
      return prev;
    });
  };

  // Genres sorted A-Z for display
  const genresAZ = Array.isArray(genresList)
    ? [...genresList].sort((a, b) => (a.name || "").localeCompare(b.name || "", "vi"))
    : [];

  const sortValue = sort || "updatedAt";

  return (
    <div className="container-page mx-auto px-4 py-6">
      {/* Header row with title and sort */}
      <div className="mb-4 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative h-[15px] w-[15px]">
            <img src="/images/icons/multi-star.svg" alt="" className="absolute top-0 left-[4.62px] h-4" />
          </div>
          <h1 className="text-txt-primary text-2xl font-semibold uppercase">Danh sách truyện</h1>
        </div>

        <div className="w-full max-w-xs md:max-w-sm">
          <Dropdown
            options={[
              { value: "updatedAt", label: "Mới cập nhật" },
              { value: "createdAt", label: "Mới nhất" },
              { value: "oldest", label: "Cũ nhất" },
              { value: "views", label: "Xem nhiều" },
              { value: "az", label: "A-Z" },
              { value: "za", label: "Z-A" },
            ]}
            value={sortValue}
            onSelect={(v) => handleSortChange(String(v))}
          />
        </div>
      </div>

      {/* Layout: list + sidebar */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_360px]">
        {/* List */}
        <section className="min-w-0">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {manga.map((item) => (
              <MangaCard
                key={item.id}
                manga={item}
                imgLoading="lazy"
                imgFetchPriority="auto"
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
            </div>
          )}
        </section>

        {/* Sidebar */}
        <aside className="w-full md:justify-self-end">
          {/* Status filter card */}
          <div className="bg-bgc-layer1 border-bd-default mb-6 rounded-2xl border p-4">
            <h2 className="text-txt-primary mb-3 text-lg font-semibold">Tình trạng</h2>
            <div className="mb-4 space-y-3">
              <label className="flex items-center gap-2 text-sm text-txt-primary">
                <input id="f-status-ongoing" type="checkbox" className="accent-fuchsia-400" defaultChecked={statusSet.has("ongoing")} />
                Chưa hoàn thành
              </label>
              <label className="flex items-center gap-2 text-sm text-txt-primary">
                <input id="f-status-completed" type="checkbox" className="accent-fuchsia-400" defaultChecked={statusSet.has("completed")} />
                Đã hoàn thành
              </label>
            </div>
            <button
              type="button"
              onClick={applyFilters}
              className="w-full rounded-xl bg-bgc-layer2 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Lọc
            </button>
          </div>

          {/* Genres list: hidden on mobile */}
          <div className="hidden lg:block">
            <div className="text-txt-primary mb-3 text-lg font-semibold">Thể loại</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {genresAZ.map((g) => (
                <a
                  key={g.slug}
                  href={`/genres/${g.slug}`}
                  title={g.description || g.name}
                  className="text-txt-primary text-sm hover:text-txt-focus"
                >
                  {g.name}
                </a>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
