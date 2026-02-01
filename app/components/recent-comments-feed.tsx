import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { Link } from "react-router-dom";
import { User as UserIcon, MessageSquare } from "lucide-react";

import { CommentReactionSummary } from "~/components/comment-reaction";
import { LoadingSpinner } from "~/components/loading-spinner";
import { getPosterVariantForContext } from "~/utils/poster-variants.utils";
import { buildMangaUrl, getMangaHandle } from "~/utils/manga-url.utils";
import { formatDistanceToNow } from "~/utils/date.utils";

import type { ReactionCounts } from "~/constants/reactions";

interface FeedItem {
  id: string;
  content: string;
  parentId?: string;
  createdAt: string | Date;
  reactionCounts?: Partial<ReactionCounts>;
  totalReactions?: number;
  user?: { id: string; name: string; avatar?: string } | null;
  manga?: { id: string; slug?: string | null; title: string; poster?: string } | null;
}

interface RecentCommentsFeedProps {
  initialData?: FeedItem[];
  initialPage?: number;
  initialTotalPages?: number;
  showPagination?: boolean;
  pageSize?: number;
}

export default function RecentCommentsFeed({
  initialData = [],
  initialPage = 1,
  initialTotalPages = 1,
  showPagination = true,
  pageSize = 10,
}: RecentCommentsFeedProps) {
  const [items, setItems] = useState<FeedItem[]>(initialData ?? []);
  const [currentPage, setCurrentPage] = useState(initialPage ?? 1);
  const [totalPages, setTotalPages] = useState(initialTotalPages ?? 1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLUListElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadPage = useCallback(
    async (page: number) => {
      if (isLoading) return;
      if (page > totalPages) return;
      setIsLoading(true);
      setError(null);
      try {
        const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
        const url = new URL("/api/comments/recent", base);
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", String(pageSize));
        url.searchParams.set("_", Date.now().toString());

        const res = await fetch(url.href, {
          credentials: "include",
          headers: { "X-Requested-With": "fetch" },
        });
        const data = await res.json();
        if (!res.ok || data?.success === false) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }

        const nextItems = Array.isArray(data?.data) ? data.data : [];
        setTotalPages(data?.totalPages ?? 1);
        setCurrentPage(data?.currentPage ?? page);
        setItems((prev) => {
          const merged = page === 1 ? nextItems : [...prev, ...nextItems];
          return merged.slice(0, 20);
        });
      } catch (e: any) {
        setError(e?.message || "Không thể tải bình luận");
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, pageSize, totalPages],
  );

  useEffect(() => {
    if ((initialData?.length ?? 0) === 0) {
      loadPage(1);
    }
  }, [initialData, loadPage]);

  useEffect(() => {
    if (!showPagination) return;
    const sentinel = sentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (isLoading) return;
        if (currentPage >= totalPages) return;
        loadPage(currentPage + 1);
      },
      {
        root,
        rootMargin: "0px 0px 120px 0px",
        threshold: 0.01,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [currentPage, totalPages, isLoading, loadPage, showPagination]);

  const GIF_REGEX = useMemo(
    () => /https?:\/\/[^ \n]*\/gif-meme\/[^\s)]+\.(?:gif|webp|jpe?g|png)/gi,
    [],
  );
  const stripGifLinks = (text: string) => (text || "").replace(GIF_REGEX, "").replace(/\n{3,}/g, "\n\n").trim();
  const extractGifLinks = (text: string) => (text.match(GIF_REGEX) ?? []).slice(0, 1);

  return (
    <div className="bg-bgc-layer1 border-bd-default w-full overflow-hidden rounded-2xl border p-0 ml-auto mt-6 md:mt-8">
      <div className="flex items-center gap-2 px-4 py-3">
        <MessageSquare className="h-6 w-6 text-lav-500" />
        <span className="text-txt-primary text-base font-semibold uppercase">bình luận</span>
      </div>

      {isLoading && items.length === 0 && (
        <div className="flex justify-center py-6">
          <LoadingSpinner />
        </div>
      )}

      {!isLoading && error && <div className="text-error-error px-4 py-3 text-sm">{error}</div>}

      {!error && (
        <ul
          ref={listRef}
          className="divide-bd-default border-bd-default flex max-h-[520px] flex-col divide-y overflow-y-auto overflow-x-hidden overscroll-contain"
        >
          {items.map((c: FeedItem) => {
            const avatarUrl = c.user?.avatar || "";
            const mangaHandle = c.manga ? getMangaHandle(c.manga as any) : null;
            const mangaHref = mangaHandle ? buildMangaUrl(c.manga as any) : null;
            return (
              <li key={c.id} className="flex items-start gap-3 px-3 py-3">
                <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#121826] ring-1 ring-white/10">
                  <UserIcon className="h-4 w-4 text-txt-primary" />
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={c.user?.name || "user"}
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                      loading="lazy"
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <span className="truncate max-w-[40%] font-medium text-white/80">{c.user?.name ?? "Ẩn danh"}</span>
                    <span className="text-white/50">→</span>
                    {mangaHref ? (
                      <Link
                        to={mangaHref}
                        className="truncate max-w-[40%] text-lav-300 hover:text-lav-200 [touch-action:manipulation]"
                      >
                        {c.manga?.title ?? "?"}
                      </Link>
                    ) : (
                      <span className="truncate max-w-[40%] text-white/60">{c.manga?.title ?? "?"}</span>
                    )}
                    <span className="ml-auto text-[11px] text-white/40">{formatDistanceToNow(new Date(c.createdAt))}</span>
                  </div>
                  <div className="mt-1 text-sm leading-5 text-white/90">
                    {stripGifLinks(c.content)}
                    {extractGifLinks(c.content).length > 0 && (
                      <span className="ml-2 inline-flex items-center gap-1 align-middle">
                        {extractGifLinks(c.content).map((url, idx) => (
                          <img
                            key={idx}
                            src={url}
                            alt="GIF"
                            className="h-[40px] w-auto rounded"
                            loading="lazy"
                            decoding="async"
                          />
                        ))}
                      </span>
                    )}

                    <CommentReactionSummary
                      compact
                      className="mt-2"
                      reactionCounts={(c as any).reactionCounts}
                      totalReactions={(c as any).totalReactions}
                    />
                  </div>
                </div>

                {c.manga?.poster ? (
                  mangaHref ? (
                    <Link
                      to={mangaHref}
                      className="ml-2 flex flex-shrink-0 overflow-hidden rounded-md [touch-action:manipulation]"
                      aria-label={c.manga?.title}
                    >
                      <div className="w-[39.2px] sm:w-[44.8px] aspect-[2/3]">
                        <img
                          src={getPosterVariantForContext(c.manga, "small")?.url || c.manga.poster}
                          alt=""
                          className="h-full w-full object-cover opacity-80"
                          loading="lazy"
                        />
                      </div>
                    </Link>
                  ) : (
                    <div className="ml-2 flex flex-shrink-0 overflow-hidden rounded-md opacity-70" aria-hidden>
                      <div className="w-[39.2px] sm:w-[44.8px] aspect-[2/3]">
                        <img
                          src={getPosterVariantForContext(c.manga, "small")?.url || c.manga.poster}
                          alt=""
                          className="h-full w-full object-cover opacity-80"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  )
                ) : null}
              </li>
            );
          })}

          {items.length === 0 && <li className="px-4 py-4 text-center text-sm text-white/60">Chưa có bình luận</li>}
          {isLoading && items.length > 0 && (
            <li className="flex justify-center px-3 py-3">
              <LoadingSpinner />
            </li>
          )}
          {showPagination && (
            <li className="px-3 py-2">
              <div ref={sentinelRef} className="h-1" />
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
