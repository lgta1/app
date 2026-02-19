import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, Link, useLoaderData } from "react-router-dom";

import { buildMangaUrl } from "~/utils/manga-url.utils";
import { getPosterVariantForContext } from "~/utils/poster-variants.utils";
import { scopeLabel } from "~/utils/text-normalize";

const SEARCH_PAGE_SIZE = 40;
const SEARCH_MAX_TOTAL = 80;
const MAX_PAGE = 2;

type SearchPageData = {
  query: string;
  page: number;
  tookMs: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  items: Array<{
    id: string;
    slug?: string;
    title: string;
    poster: string;
    genres: string[];
    chapters: number;
    scope: "title" | "alias" | "character" | "doujinshi";
    altTitle?: string;
    highlight?: {
      field: "title" | "alias" | "character" | "doujinshi";
      snippet: string;
    };
  }>;
  total: number;
};

export const meta: MetaFunction = ({ data }) => {
  const query = (data as SearchPageData | undefined)?.query?.trim();
  if (!query) {
    return [
      { title: "Tìm kiếm truyện | WW" },
      { name: "description", content: "Tìm truyện theo từ khóa" },
    ];
  }
  return [
    { title: `Kết quả tìm kiếm: ${query} | WW` },
    { name: "description", content: `Kết quả tìm kiếm cho từ khóa ${query}` },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { basicSearch } = await import("~/services/search/basic-search.server");
  const { sharedTtlCache } = await import("~/.server/utils/ttl-cache");

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  const pageParam = Number.parseInt(url.searchParams.get("page") || "1", 10);
  const page = Number.isFinite(pageParam) ? Math.min(MAX_PAGE, Math.max(1, pageParam)) : 1;
  const offset = (page - 1) * SEARCH_PAGE_SIZE;

  if (!query) {
    return {
      query: "",
      page: 1,
      tookMs: 0,
      limit: SEARCH_PAGE_SIZE,
      hasNextPage: false,
      hasPrevPage: false,
      total: 0,
      items: [],
    } satisfies SearchPageData;
  }

  const normalizedQuery = query.toLowerCase();
  const cacheKey = `page.search:q=${encodeURIComponent(normalizedQuery)}:offset=${offset}:limit=${SEARCH_PAGE_SIZE}:cap=${SEARCH_MAX_TOTAL}`;

  const startedAt = Date.now();
  const result = await sharedTtlCache.getOrSet(cacheKey, 10_000, () =>
    basicSearch({
      query: normalizedQuery,
      limit: SEARCH_PAGE_SIZE,
      offset,
      maxTotal: SEARCH_MAX_TOTAL,
    }),
  );
  const tookMs = Date.now() - startedAt;

  return {
    query,
    page,
    tookMs,
    limit: SEARCH_PAGE_SIZE,
    hasNextPage: page < MAX_PAGE && result.hasMore,
    hasPrevPage: page > 1,
    total: result.total,
    items: result.items,
  } satisfies SearchPageData;
}

export default function SearchPage() {
  const data = useLoaderData<typeof loader>();
  const hasQuery = Boolean(data.query.trim());

  return (
    <div className="container-page mx-auto px-4 py-6 pb-24">
      <h1 className="text-txt-primary mb-2 text-3xl font-semibold">Tìm kiếm</h1>
      <div className="mb-6 h-1.5 w-20 bg-fuchsia-400" />

      <Form method="get" action="/search" className="bg-bgc-layer2 mb-6 flex items-center gap-2 rounded-xl px-4 py-3">
        <input
          type="text"
          name="q"
          defaultValue={data.query}
          placeholder="Nhập từ khóa và nhấn Enter"
          className="text-txt-primary placeholder:text-txt-secondary w-full bg-transparent text-base outline-none"
          autoFocus
        />
      </Form>

      <div className="mb-6">
        <Link
          to={{ pathname: "/search/advanced", search: data.query.trim() ? `?q=${encodeURIComponent(data.query.trim())}` : "" } as unknown as string}
          className="inline-flex items-center gap-2 rounded-full border border-[#C084FC] bg-bgc-layer2/80 px-4 py-2 text-sm font-semibold text-[#E0B2FF] transition hover:bg-bgc-layer2"
        >
          Tới tìm kiếm nâng cao
        </Link>
      </div>

      {!hasQuery && (
        <p className="text-txt-secondary text-sm">Nhập từ khóa để bắt đầu tìm kiếm truyện.</p>
      )}

      {hasQuery && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-txt-secondary text-sm">
            Từ khóa: <span className="text-txt-primary font-semibold">{data.query}</span>
          </p>
        </div>
      )}

      {hasQuery && data.items.length === 0 && (
        <div className="bg-bgc-layer2 rounded-xl p-6 text-center">
          <p className="text-txt-secondary">Không tìm thấy truyện phù hợp.</p>
        </div>
      )}

      <div className="space-y-2">
        {data.items.map((item, index) => {
          const highlightIsTitle = item.highlight?.field === "title";
          return (
            <Link
              key={item.id}
              to={buildMangaUrl(item.slug ?? item.id)}
              className={`border-bd-default hover:bg-bgc-layer2 flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                index === 0 ? "bg-bgc-layer2/70" : "bg-bgc-layer1"
              }`}
            >
              <img
                src={getPosterVariantForContext(item, "small")?.url || item.poster}
                alt={item.title}
                className="h-[7.8rem] w-[5.2rem] flex-shrink-0 rounded-lg object-cover"
              />

              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="text-txt-primary line-clamp-1 text-base font-semibold">
                  {highlightIsTitle && item.highlight ? (
                    <span dangerouslySetInnerHTML={{ __html: item.highlight.snippet }} />
                  ) : (
                    item.title
                  )}
                </h2>

                {!highlightIsTitle && item.highlight && (
                  <p
                    className="text-txt-focus line-clamp-1 text-xs font-medium"
                    dangerouslySetInnerHTML={{ __html: item.highlight.snippet }}
                  />
                )}

                {item.altTitle && (
                  <p className="text-txt-secondary line-clamp-1 text-xs italic">{item.altTitle}</p>
                )}

                <p className="text-txt-secondary line-clamp-2 text-base">{item.genres.join(", ")}</p>

                <p className="text-txt-focus text-[11px] font-semibold">
                  {scopeLabel(item.scope)} · {item.chapters} chương
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {hasQuery && (data.hasPrevPage || data.hasNextPage) && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {data.hasPrevPage ? (
            <Link
              to={`/search?q=${encodeURIComponent(data.query)}&page=${data.page - 1}`}
              className="bg-bgc-layer2 text-txt-primary rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Trang 1
            </Link>
          ) : (
            <span className="bg-bgc-layer2 text-txt-secondary rounded-lg px-4 py-2 text-sm font-semibold opacity-60">
              Trang 1
            </span>
          )}

          {data.hasNextPage ? (
            <Link
              to={`/search?q=${encodeURIComponent(data.query)}&page=${data.page + 1}`}
              className="bg-bgc-layer2 text-txt-primary rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Trang 2
            </Link>
          ) : (
            <span className="bg-bgc-layer2 text-txt-secondary rounded-lg px-4 py-2 text-sm font-semibold opacity-60">
              Trang 2
            </span>
          )}
        </div>
      )}
    </div>
  );
}
