import { Eye, Heart } from "lucide-react";

import { LoadingSpinner } from "~/components/loading-spinner";
import { Pagination } from "~/components/pagination";
import type { MangaType } from "~/database/models/manga.model";
import { usePagination } from "~/hooks/use-pagination";

export function ProfileMangaRecentRead() {
  const {
    data: recentReadMangas,
    currentPage,
    totalPages,
    isLoading,
    error,
    goToPage,
  } = usePagination<MangaType>({
    apiUrl: "/api/manga/recent-read",
    limit: 5,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-error-error text-sm font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <div className="text-txt-secondary text-sm font-medium">
        Tổng cộng: {recentReadMangas.length}
      </div>

      {recentReadMangas.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-txt-secondary text-sm font-medium">
            Bạn chưa đọc truyện nào gần đây
          </p>
        </div>
      ) : (
        <>
          <div className="flex w-full flex-col gap-2">
            {recentReadMangas.map((manga) => (
              <div
                key={manga.id}
                className="bg-bgc-layer1 border-bd-default flex w-full items-center justify-between rounded-xl border p-3"
              >
                <div className="flex items-center gap-3">
                  <img
                    className="h-8 w-8 rounded object-cover"
                    src={manga.poster}
                    alt={manga.title}
                  />
                  <div className="flex flex-1 flex-col gap-0.5">
                    <h3 className="text-txt-primary line-clamp-1 text-sm leading-tight font-medium">
                      {manga.title}
                    </h3>
                    <div className="flex flex-wrap items-start gap-2">
                      <span className="text-txt-focus text-xs font-medium">
                        Chapter {manga.chapters}
                      </span>
                      <div className="flex items-center gap-1.5 rounded-[32px] backdrop-blur-[3.40px]">
                        <Eye className="text-txt-secondary h-3 w-3" />
                        <span className="text-txt-secondary text-xs font-medium">
                          {manga.viewNumber?.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-[32px] backdrop-blur-[3.40px]">
                        <Heart className="text-txt-secondary h-3 w-3" />
                        <span className="text-txt-secondary text-xs font-medium">
                          {manga.likeNumber?.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex w-full justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
