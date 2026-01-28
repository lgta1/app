import {
  useLoaderData,
  useSearchParams,
} from "react-router-dom";

import type { Route } from "./+types/genres.$slug";

import {
  getTotalMangaCount,
  searchMangaApprovedWithPagination,
} from "@/queries/manga.query";

import { Dropdown } from "~/components/dropdown";
import { MangaCard } from "~/components/manga-card";
import { Pagination } from "~/components/pagination";
import { MANGA_CONTENT_TYPE, MANGA_STATUS, MANGA_USER_STATUS } from "~/constants/manga";
import { GenresModel, type GenresType } from "~/database/models/genres.model";
import type { MangaType } from "~/database/models/manga.model";

export const meta: Route.MetaFunction = ({ data }) => {
  if (!data?.genre) {
    return [
      { title: "Thể loại truyện | Vinahentai" },
      {
        name: "description",
        content: "Khám phá các thể loại truyện tại Vinahentai",
      },
    ];
  }

  return [
    { title: `${data.genre.name} | Vinahentai` },
    {
      name: "description",
      content:
        data.genre.description || `Khám phá thể loại ${data.genre.name} tại Vinahentai`,
    },
  ];
};

export async function loader({ params, request }: Route.LoaderArgs) {
  const { sharedTtlCache } = await import("~/.server/utils/ttl-cache");
  const { getCanonicalOrigin } = await import("~/.server/utils/canonical-url");

  const { slug } = params;
  if (!slug) {
    throw new Response("Không tìm thấy thể loại", { status: 404 });
  }
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const sortParam = url.searchParams.get("sort") || "updatedAt";
  const limit = 18;

  const cacheKey = `loader:genres:${slug}:page=${page}:sort=${sortParam}`;
  const cursorKey = `cursor:genres:${slug}:sort=${sortParam}:page=${page}`;
  const nextCursorKey = `cursor:genres:${slug}:sort=${sortParam}:page=${page + 1}`;
  const cachedCursor = page > 1 ? sharedTtlCache.get<Record<string, any>>(cursorKey) : undefined;

  const cached = await sharedTtlCache.getOrSet(cacheKey, 30_000, async () => {
    const genre = await GenresModel.findOne({ slug }).lean();

    if (!genre) {
      return null;
    }

    const isCosplayGenre = genre.slug === "anh-cosplay" || genre.slug === "cosplay";

    const query: Record<string, any> = {
      genres: isCosplayGenre ? { $in: ["anh-cosplay", "cosplay"] } : genre.slug,
      status: MANGA_STATUS.APPROVED,
    };

    if (isCosplayGenre) {
      query.contentType = MANGA_CONTENT_TYPE.COSPLAY;
    } else {
      query.contentType = { $in: [MANGA_CONTENT_TYPE.MANGA, null] };
    }

    // sorting & extra filtering
    let sort: Record<string, 1 | -1> | undefined;
    switch (sortParam) {
      case "viewNumber":
        sort = { viewNumber: -1 };
        break;
      case "likeNumber":
        // Legacy: `likeNumber` previously meant "Được yêu thích".
        // Now map it to rating-based ordering.
        sort = { ratingScore: -1, ratingTotalVotes: -1, viewNumber: -1 };
        break;
      case "completed":
        query.userStatus = MANGA_USER_STATUS.COMPLETED;
        sort = { updatedAt: -1 };
        break;
      case "oldest":
        sort = { updatedAt: 1 };
        break;
      case "updatedAt":
      default:
        sort = { updatedAt: -1 };
        break;
    }

    const [manga, totalCount] = await Promise.all([
      searchMangaApprovedWithPagination({ page, limit, query, sort, cursor: cachedCursor }),
      getTotalMangaCount({ query }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    const buildCursorFromDoc = (doc: MangaType | undefined, sortSpec: Record<string, 1 | -1> | undefined) => {
      if (!doc || !sortSpec) return null;
      const cursor: Record<string, any> = {};
      for (const [field] of Object.entries(sortSpec)) {
        const value = (doc as any)[field];
        if (value === undefined || value === null) return null;
        cursor[field] = value;
      }
      const idValue = (doc as any)._id ?? (doc as any).id;
      if (!idValue) return null;
      cursor._id = idValue;
      return cursor;
    };

    const lastDoc = manga[manga.length - 1] as MangaType | undefined;
    const nextCursor = buildCursorFromDoc(lastDoc, sort ?? { updatedAt: -1 });
    if (nextCursor) {
      await sharedTtlCache.getOrSet(nextCursorKey, 30_000, async () => nextCursor);
    }

    return {
      genre,
      manga,
      currentPage: page,
      totalPages,
      sort: sortParam,
    };
  });

  if (!cached) {
    throw new Response("Không tìm thấy thể loại", { status: 404 });
  }

  const origin = getCanonicalOrigin(request as any);
  return {
    ...cached,
    canonical: `${origin}/genres/${cached.genre.slug}`,
  };
}

export default function Genres() {
  const { genre, manga, currentPage, totalPages } = useLoaderData<{
    genre: GenresType;
    manga: MangaType[];
    currentPage: number;
    totalPages: number;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const sortParam = searchParams.get("sort") || "updatedAt";

  const handlePageChange = (page: number) => {
    setSearchParams((prev) => {
      prev.set("page", page.toString());
      return prev;
    });
  };

  const handleSortChange = (value: string) => {
    setSearchParams((prev) => {
      prev.set("sort", value);
      prev.set("page", "1");
      return prev;
    });
  };

  return (
    <div className="container-page mx-auto px-4 py-6">
      <div className="mb-8 flex flex-col items-start justify-start gap-3.5">
        <h1 className="text-txt-primary text-4xl leading-10 font-semibold">
          {genre?.name}
        </h1>
        <div className="h-1.5 w-20 bg-fuchsia-400" />
        <p className="text-txt-primary text-sm leading-tight font-normal">
          {genre?.description}
        </p>

        <div className="mt-2 flex items-center gap-3">
          <span className="text-txt-secondary text-sm">Sắp xếp theo:</span>
          <div className="w-64">
            <Dropdown
              options={[
                { value: "updatedAt", label: "Mới cập nhật" },
                { value: "oldest", label: "Cũ nhất" },
                { value: "viewNumber", label: "Đọc nhiều" },
                { value: "likeNumber", label: "Đánh giá cao" },
                { value: "completed", label: "Đã hoàn thành" },
              ]}
              value={sortParam}
              onSelect={(v) => handleSortChange(String(v))}
            />
          </div>
        </div>
      </div>

      {/* Manga list */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {manga.map((item) => (
          <MangaCard key={item.id} manga={item} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
