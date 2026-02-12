import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { LoadingSpinner } from "~/components/loading-spinner";
import { MangaCard } from "~/components/manga-card";
import LazyRender from "~/components/lazy-render";
import { Pagination } from "~/components/pagination";
import type { MangaType } from "~/database/models/manga.model";
import { buildMangaUrl } from "~/utils/manga-url.utils";

type LatestUpdatesProps = {
  initialData: MangaType[];
  initialPage: number;
  initialTotalPages: number;
  title?: string;
  // Custom class for the container <section>. If omitted, defaults to "mt-8".
  containerClassName?: string;
  // Hiển thị phân trang phía dưới danh sách (mặc định: true)
  showPagination?: boolean;
  // Chế độ dành cho trang Index: ẩn phân trang, chỉ hiện nút dẫn tới /danh-sach?page=2
  indexMode?: boolean;
};

export function LatestUpdates({
  initialData,
  initialPage,
  initialTotalPages,
  title = "Truyện hentai mới",
  containerClassName,
  showPagination = true,
  indexMode = false,
}: LatestUpdatesProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  // Local paging states (no hook) to eliminate races
  const [page, setPage] = useState<number>(initialPage ?? 1);
  const [totalPages, setTotalPages] = useState<number>(initialTotalPages ?? 1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [renderList, setRenderList] = useState<MangaType[]>(initialData ?? []);
  const [appendCount, setAppendCount] = useState(0);
  const appendCountRef = useRef(0);
  const MAX_APPENDS = 2; // 20 -> 40 -> 60

  const listTopRef = useRef<HTMLDivElement | null>(null);
  const [gotoPageInput, setGotoPageInput] = useState<string>("");

  const debug = useMemo(() => (typeof window !== "undefined" && localStorage.getItem("debug_latest") === "1"), []);

  // Update URL ?page without triggering a navigation
  const setUrlPage = (next: number, opts: { replace?: boolean } = {}) => {
    try {
      const { replace = false } = opts;
      setSearchParams(
        (prev) => {
          const nextParams = new URLSearchParams(prev);
          if (next > 1) nextParams.set("page", String(next));
          else nextParams.delete("page");
          return nextParams;
        },
        { replace, preventScrollReset: true },
      );
    } catch {}
  };

  const apiLoad = async (targetPage: number) => {
    const url = new URL("/api/manga/latest", window.location.origin);
    url.searchParams.set("page", String(targetPage));
    url.searchParams.set("limit", "20");
    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json as { data: MangaType[]; totalPages: number; currentPage: number; success?: boolean };
  };

  const resetTo = (items: MangaType[], nextPage: number, doScroll: boolean) => {
    setRenderList(items);
    setPage(nextPage);
    if (doScroll) {
      const el = listTopRef.current;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => el?.scrollIntoView({ behavior: "smooth", block: "start" }));
      });
    }
  };

  const appendWith = (items: MangaType[], nextPage: number) => {
    setRenderList((prev: MangaType[]) => [...prev, ...items]);
    setPage(nextPage);
    appendCountRef.current += 1;
    setAppendCount(appendCountRef.current);
  };

  // Initial ?page handling (no scroll)
  useEffect(() => {
    const urlPageParam = Number(searchParams.get("page") || "1");
    if (!Number.isNaN(urlPageParam) && urlPageParam > 0 && urlPageParam !== page) {
      setIsLoading(true);
      apiLoad(urlPageParam)
        .then((res) => {
          setTotalPages(res.totalPages || 1);
          resetTo(res.data || [], res.currentPage || urlPageParam, false);
          appendCountRef.current = 0;
          setAppendCount(0);
        })
        .catch((e) => setError(e.message))
        .finally(() => setIsLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChangePage = (targetPage: number) => {
    if (targetPage < 1 || targetPage > totalPages || targetPage === page) return;
    setIsLoading(true);
    apiLoad(targetPage)
      .then((res) => {
        setTotalPages(res.totalPages || 1);
        resetTo(res.data || [], res.currentPage || targetPage, true);
        setUrlPage(res.currentPage || targetPage);
        appendCountRef.current = 0;
        setAppendCount(0);
      })
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  };

  const handleLoadMore = () => {
    if (page >= totalPages) return;
    const atLimit = appendCountRef.current >= MAX_APPENDS;
    const nextPage = Math.min(page + 1, totalPages);
    setIsLoading(true);
    apiLoad(nextPage)
      .then((res) => {
        setTotalPages(res.totalPages || totalPages);
        if (!atLimit) {
          appendWith(res.data || [], res.currentPage || nextPage);
        } else {
          appendCountRef.current = 0;
          setAppendCount(0);
          resetTo(res.data || [], res.currentPage || nextPage, true);
          setUrlPage(res.currentPage || nextPage);
        }
        if (debug) {
          // eslint-disable-next-line no-console
          console.log("[Latest] loadMore:", { page, nextPage, atLimit, added: (res.data || []).length, totalPages: res.totalPages });
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  };

  // remove legacy hook-based handlers

  const atLimitForLabel = appendCount >= MAX_APPENDS;
  const canLoadMore = page < totalPages;
  const loadMoreLabel = atLimitForLabel && canLoadMore ? "Sang trang kế tiếp" : "Xem thêm 20 truyện";

  const clampPage = (n: number) => Math.min(Math.max(n, 1), Math.max(1, totalPages));
  const submitGoto = () => {
    const val = Number(gotoPageInput);
    if (!Number.isFinite(val)) return;
    const target = clampPage(Math.round(val));
    if (target === page) return;
    handleChangePage(target);
  };

  // Default top spacing is mt-8, but allow override from parent (e.g., homepage layout alignment)
  const containerClass = containerClassName ?? "mt-8";
  // Dùng LazyRender cho cả index (desktop) để ép load sớm hơn, tránh nền đen do browser trì hoãn
  const useLazyCards = true;
  const cardRootMargin = indexMode ? "1200px" : "900px";

  return (
    <section className={containerClass}>
      {/* Anchor để cuộn về đầu section */}
      <div ref={listTopRef} className="scroll-mt-16" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative h-[15px] w-[15px]">
            <img src="/images/icons/multi-star.svg" alt="" className="absolute top-0 left-[4.62px] h-4" />
          </div>
          <h2 className="text-txt-primary text-xl font-semibold uppercase">{title}</h2>
        </div>
      </div>

      {isLoading && renderList.length === 0 ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          <div className="mt-6 -mx-2 grid grid-cols-2 gap-y-4 gap-x-2 sm:mx-0 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
            {renderList.map((manga) => {
              const mangaHref = buildMangaUrl(manga);
              const card = (
                <MangaCard
                  key={useLazyCards ? undefined : manga.id}
                  manga={manga}
                  compact
                  boostTitle
                  cornerTimeBadge={indexMode}
                  imgLoading="lazy"
                  imgFetchPriority={useLazyCards ? "high" : "auto"}
                />
              );

              if (!useLazyCards) return card;

              return (
                <LazyRender
                  key={manga.id}
                  rootMargin={cardRootMargin}
                  placeholder={
                    // lightweight placeholder that preserves layout (same aspect ratio + title)
                    <a
                      href={mangaHref}
                      className="group bg-bgc-layer1 relative block overflow-hidden rounded-xl border border-white/5"
                      aria-label={manga.title}
                    >
                      <div className="relative aspect-[2/3] w-full bg-[rgba(255,255,255,0.02)]" />
                      <div className="p-2 pb-1">
                        <h3 className="truncate text-base leading-5 font-semibold text-white" title={manga.title}>
                          {manga.title}
                        </h3>
                      </div>
                    </a>
                  }
                >
                  {card}
                </LazyRender>
              );
            })}
          </div>

          {/* Index mode: chỉ hiện nút dẫn tới trang danh sách page=2 */}
          {indexMode ? (
            <div className="mt-8 flex justify-center">
              <a
                href="/danh-sach?page=2"
                className="rounded-xl bg-btn-primary px-4 py-2 text-sm font-semibold text-bgc-layer1 hover:opacity-90 active:opacity-80"
                aria-label="Xem thêm"
              >
                Xem thêm
              </a>
            </div>
          ) : (
            totalPages > 1 && canLoadMore && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={handleLoadMore}
                className="rounded-xl bg-btn-primary px-4 py-2 text-sm font-semibold text-bgc-layer1 hover:opacity-90 active:opacity-80"
                aria-label={loadMoreLabel}
              >
                {loadMoreLabel}
              </button>
            </div>
            )
          )}

          {!indexMode && showPagination && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center">
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={handleChangePage} />
            </div>
          )}

          {!indexMode && showPagination && totalPages > 1 && (
            <div className="mt-3 flex items-center justify-center">
              <div className="inline-flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, totalPages)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Tới trang…"
                  value={gotoPageInput}
                  onChange={(e) => setGotoPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitGoto();
                  }}
                  className="h-10 w-24 rounded-md border border-bd-default bg-bgc-layer1 px-3 text-sm outline-none ring-0 focus:border-lav-500"
                  aria-label="Tới trang"
                />
                <button
                  type="button"
                  onClick={submitGoto}
                  className="h-10 rounded-md bg-btn-primary px-4 text-sm font-semibold text-bgc-layer1 hover:opacity-90 active:opacity-80"
                  aria-label="Đi tới trang đã nhập"
                >
                  Đi
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default LatestUpdates;
