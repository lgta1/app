import { Link } from "react-router";
import { MessageCircle } from "lucide-react";

import { Pagination } from "./pagination";

import { usePagination } from "~/hooks/use-pagination";
import { formatDistanceToNow } from "~/utils/date.utils";

interface UserComment {
  _id: string;
  content: string;
  mangaId: {
    _id: string;
    title: string;
    poster: string;
  };
  createdAt: Date;
}

interface ProfileRecentCommentProps {
  className?: string;
}

export function ProfileRecentComment({ className }: ProfileRecentCommentProps) {
  const {
    data: comments,
    currentPage,
    totalPages,
    isLoading,
    error,
    goToPage,
  } = usePagination<UserComment>({
    apiUrl: "/api/user-comments",
    limit: 5,
  });

  if (error) {
    return (
      <div className="inline-flex w-full max-w-[968px] flex-col items-start justify-start gap-4">
        <div className="inline-flex items-center justify-start gap-3">
          <MessageCircle className="text-lav-500 h-5 w-5 fill-current" />
          <div className="text-txt-primary justify-center font-sans text-xl leading-7 font-semibold uppercase">
            bình luận đã đăng
          </div>
        </div>
        <div className="text-error-error self-stretch p-4 text-center">{error}</div>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex w-full max-w-[968px] flex-col items-start justify-start gap-4 ${className || ""}`}
    >
      {/* Header */}
      <div className="inline-flex items-center justify-start gap-3">
        <MessageCircle className="text-lav-500 h-5 w-5 fill-current" />
        <div className="text-txt-primary justify-center font-sans text-xl leading-7 font-semibold uppercase">
          bình luận đã đăng
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col items-start justify-start gap-4 self-stretch">
        <div className="flex flex-col items-center justify-center gap-4 self-stretch">
          {/* Total count */}
          <div className="text-txt-secondary h-6 justify-center self-stretch font-sans text-sm leading-tight font-medium">
            Tổng cộng:{" "}
            {comments.length > 0 ? (currentPage - 1) * 10 + comments.length : 0}
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="text-txt-secondary self-stretch p-8 text-center">
              Đang tải...
            </div>
          )}

          {/* Empty state */}
          {!isLoading && comments.length === 0 && (
            <div className="text-txt-secondary self-stretch p-8 text-center">
              Bạn chưa có bình luận nào
            </div>
          )}

          {/* Comments list */}
          {!isLoading && comments.length > 0 && (
            <div className="flex w-full flex-col items-start justify-start gap-2">
              {comments.map((comment) => (
                <Link
                  key={comment._id}
                  to={`/manga/${comment.mangaId._id}`}
                  className="bg-bgc-layer1 border-bd-default inline-flex items-start justify-between self-stretch rounded-xl border p-3"
                >
                  <div className="flex flex-1 items-start justify-start gap-3 sm:w-[522px]">
                    <img
                      className="h-8 w-8 flex-shrink-0 rounded object-cover"
                      src={comment.mangaId.poster || "https://placehold.co/34x34"}
                      alt={`${comment.mangaId.title} cover`}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "https://placehold.co/34x34";
                      }}
                    />
                    <div className="inline-flex min-w-0 flex-1 flex-col items-start justify-start gap-0.5">
                      <div className="text-txt-primary line-clamp-1 justify-center self-stretch font-sans text-sm leading-tight font-medium">
                        {comment.mangaId.title}
                      </div>
                      <div className="text-txt-secondary line-clamp-3 w-full justify-center font-sans text-xs leading-none font-medium sm:max-w-[484px]">
                        &ldquo;{comment.content}&rdquo;
                      </div>
                    </div>
                  </div>
                  <div className="text-txt-secondary ml-3 flex-shrink-0 justify-center font-sans text-xs leading-normal font-medium sm:text-base">
                    {formatDistanceToNow(comment.createdAt)}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && comments.length > 0 && totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={goToPage}
            />
          )}
        </div>
      </div>
    </div>
  );
}
