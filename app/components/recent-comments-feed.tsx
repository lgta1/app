import { useMemo } from "react";
import type React from "react";
import { Link } from "react-router-dom";
import { User as UserIcon, MessageSquare } from "lucide-react";
import { CommentReactionSummary } from "~/components/comment-reaction";
import { usePagination } from "~/hooks/use-pagination";
import { LoadingSpinner } from "~/components/loading-spinner";
import { buildMangaUrl, getMangaHandle } from "~/utils/manga-url.utils";
// import { formatDistanceToNow } from "~/utils/date.utils"; // replaced by compact formatAgo()

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
  limit?: number; // số lượng tối đa muốn hiển thị mỗi lần tải (mặc định 5)
  showPagination?: boolean; // ẩn/hiện phân trang
}

export function RecentCommentsFeed({ initialData, initialPage, initialTotalPages, limit = 5, showPagination = true }: RecentCommentsFeedProps) {
  const pageSize = 10;
  const { data, isLoading, error, currentPage, totalPages, goToPage } =
    usePagination<FeedItem>({
      apiUrl: "/api/comments/recent",
      limit: pageSize,
      initialData,
      initialPage,
      initialTotalPages,
      // Nếu có dữ liệu SSR thì bỏ qua fetch đầu để tránh spinner trên mobile
      skipInitialFetch: !!initialData,
    });

  const items = useMemo(() => data || [], [data]);

  // GIF helpers: detect server GIF links and render as images (gif + static formats)
  const GIF_REGEX = useMemo(() => /https?:\/\/[^ \n]*\/gif-meme\/[^^\s)]+\.(?:gif|webp|jpe?g|png)/gi, []);
  const stripGifLinks = (text: string) => (text || "").replace(GIF_REGEX, "").replace(/\n{3,}/g, "\n\n").trim();
  const extractGifLinks = (text: string) => (text.match(GIF_REGEX) ?? []).slice(0, 1);


  return (
  <div className="bg-bgc-layer1 border-bd-default overflow-hidden rounded-2xl border p-0 w-full md:w-full ml-auto mt-6 md:mt-8">
      <div className="flex items-center gap-2 px-4 py-3">
        <MessageSquare className="h-6 w-6 text-lav-500" />
        <span className="text-txt-primary text-base font-semibold uppercase">bình luận</span>
      </div>

      {isLoading && (
        <div className="flex justify-center py-6">
          <LoadingSpinner />
        </div>
      )}

      {!isLoading && error && (
        <div className="text-error-error px-4 py-3 text-sm">{error}</div>
      )}

      {!isLoading && !error && (
        <ul className="divide-bd-default border-bd-default flex max-h-[520px] flex-col divide-y overflow-auto">
          {items.map((c: FeedItem) => {
            const avatarUrl = c.user?.avatar || "";
            const mangaHandle = c.manga ? getMangaHandle(c.manga as any) : null;
            const mangaHref = mangaHandle ? buildMangaUrl(c.manga as any) : null;
            return (
              <li key={c.id} className="flex items-start gap-3 px-3 py-3">
                {/* Avatar */}
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

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <span className="truncate max-w-[40%] font-medium text-white/80">{c.user?.name ?? "Ẩn danh"}</span>
                    <span className="text-white/50">→</span>
                    {mangaHref ? (
                      <Link
                        to={mangaHref}
                        prefetch="intent"
                        className="truncate max-w-[40%] text-lav-300 hover:text-lav-200 [touch-action:manipulation]"
                      >
                        {c.manga?.title ?? "?"}
                      </Link>
                    ) : (
                      <span className="truncate max-w-[40%] text-white/60">{c.manga?.title ?? "?"}</span>
                    )}
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

                {/* Optional small poster for quick visual context */}
                {c.manga?.poster ? (
                  mangaHref ? (
                    <Link
                      to={mangaHref}
                      prefetch="intent"
                      className="ml-2 flex flex-shrink-0 overflow-hidden rounded-md [touch-action:manipulation]"
                      aria-label={c.manga?.title}
                    >
                      <div className="w-[39.2px] sm:w-[44.8px] aspect-[2/3]">
                        <img
                          src={c.manga.poster}
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
                          src={c.manga.poster}
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

          {items.length === 0 && (
            <li className="px-4 py-4 text-center text-sm text-white/60">Chưa có bình luận</li>
          )}
        </ul>
      )}

      {!isLoading && showPagination && totalPages > 1 && (
        <div className="px-3 pb-2 pt-1">
          {currentPage === 1 ? (
            <button
              onClick={() => goToPage(2)}
              className="w-full rounded-md bg-white/5 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Trang 2 ▸
            </button>
          ) : (
            <button
              onClick={() => goToPage(1)}
              className="w-full rounded-md bg-white/5 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              ◂ Trang 1
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default RecentCommentsFeed;
