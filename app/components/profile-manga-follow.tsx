import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router-dom";
import { Eye, Heart, StarOff } from "lucide-react";

import { WarningActionDialog } from "~/components/dialog-warning-action";
import { LoadingSpinner } from "~/components/loading-spinner";
import { Pagination } from "~/components/pagination";
import type { MangaType } from "~/database/models/manga.model";
import { usePagination } from "~/hooks/use-pagination";
import { buildMangaUrl } from "~/utils/manga-url.utils";

interface ProfileMangaFollowProps {
  userId?: string;
}

export function ProfileMangaFollow({ userId }: ProfileMangaFollowProps) {
  const queryParams = userId ? { userId } : undefined;

  const PAGE_SIZE = 10;
  const {
    data: followingMangas,
    currentPage,
    totalPages,
    isLoading,
    error,
    goToPage,
    refresh,
  } = usePagination<MangaType>({
    apiUrl: "/api/manga/following",
    limit: PAGE_SIZE,
    queryParams,
  });

  const [unfollowDialog, setUnfollowDialog] = useState({
    open: false,
    mangaId: "",
  });

  const unfollowFetcher = useFetcher();

  const handleUnfollow = (mangaId: string) => {
    const formData = new FormData();
    formData.append("intent", "unfollow");
    formData.append("mangaId", mangaId);

    unfollowFetcher.submit(formData, {
      method: "POST",
      action: "/api/manga-follow",
    });
  };

  // Refresh data when unfollow is successful
  useEffect(() => {
    if (unfollowFetcher.data?.success && unfollowFetcher.state === "idle") {
      refresh();
    }
  }, [unfollowFetcher.data, unfollowFetcher.state]);

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
      {followingMangas.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-txt-secondary text-sm font-medium">
            Bạn chưa theo dõi truyện nào
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-1">
            {followingMangas.map((manga) => (
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-txt-primary line-clamp-2 text-base font-semibold">
                        {manga.title}
                      </h3>
                      <span className="text-xs font-semibold uppercase tracking-wide text-txt-focus">
                        Chapter {manga.chapters ?? 0}
                      </span>
                    </div>
                    {!userId && (
                      <button
                        type="button"
                        className={`rounded-full p-1 transition ${
                          unfollowFetcher.state === "submitting"
                            ? "text-txt-disabled"
                            : "text-txt-secondary hover:text-error-error"
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          if (unfollowFetcher.state !== "submitting") {
                            setUnfollowDialog({
                              open: true,
                              mangaId: manga.id,
                            });
                          }
                        }}
                        aria-label="Bỏ theo dõi"
                      >
                        <StarOff className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-txt-secondary sm:flex sm:flex-wrap sm:gap-4">
                    <div className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      <span>{manga.viewNumber?.toLocaleString() ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5" />
                      <span>{manga.likeNumber?.toLocaleString() ?? 0}</span>
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

      {/* Unfollow Dialog */}
      <WarningActionDialog
        open={unfollowDialog.open}
        onOpenChange={(open) => setUnfollowDialog((prev) => ({ ...prev, open }))}
        title="Bỏ theo dõi truyện?"
        message="Hành động này không thể hoàn tác. Bạn có muốn tiếp tục?"
        confirmText="Bỏ theo dõi"
        onConfirm={() => handleUnfollow(unfollowDialog.mangaId)}
      />
    </div>
  );
}
