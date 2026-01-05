import { Link } from "react-router-dom";
import { Eye } from "lucide-react";

import { LoadingSpinner } from "~/components/loading-spinner";
import { Pagination } from "~/components/pagination";
import type { MangaType } from "~/database/models/manga.model";
import { usePagination } from "~/hooks/use-pagination";
import { buildMangaUrl } from "~/utils/manga-url.utils";

interface ProfileMangaRecentReadProps {
  userId?: string;
}

export function ProfileMangaRecentRead({ userId }: ProfileMangaRecentReadProps) {
  const queryParams = userId ? { userId } : undefined;

  const PAGE_SIZE = 10;
  const {
    data: recentReadMangas,
    currentPage,
    totalPages,
    isLoading,
    error,
    goToPage,
  } = usePagination<MangaType>({
    apiUrl: "/api/manga/recent-read",
    limit: PAGE_SIZE,
    queryParams,
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
      {recentReadMangas.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-txt-secondary text-sm font-medium">
            Bạn chưa đọc truyện nào gần đây
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-1">
            {recentReadMangas.map((manga) => (
              <Link
                key={manga.id}
                to={buildMangaUrl(manga)}
                className="bg-bgc-layer1 border-bd-default group flex h-full flex-col overflow-hidden rounded-2xl border text-left transition hover:border-lav-500 lg:flex-row"
              >
                <div className="aspect-[3/4] w-full overflow-hidden bg-bgc-layer2 lg:max-w-[180px]">
                  <img
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    src={manga.poster}
                    alt={manga.title}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-txt-primary line-clamp-2 text-base font-semibold">
                      {manga.title}
                    </h3>
                    <span className="text-xs font-semibold uppercase tracking-wide text-txt-focus">
                      Chapter {manga.chapters ?? 0}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-txt-secondary sm:flex sm:flex-wrap sm:gap-4">
                    <div className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      <span>{manga.viewNumber?.toLocaleString() ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="tabular-nums">
                        {(() => {
                          const chaptersWithVotes = Number((manga as any)?.ratingChaptersWithVotes ?? 0);
                          const totalVotes = Number((manga as any)?.ratingTotalVotes ?? 0);
                          const score = Number((manga as any)?.ratingScore ?? 0);
                          if (chaptersWithVotes < 3 || totalVotes < 5) return "0.0/0";
                          return `${Math.max(0, Math.min(10, score)).toFixed(1)}/10`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex w-full justify-center">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
