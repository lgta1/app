import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router";
import { Eye, Heart, StarOff } from "lucide-react";

import { WarningActionDialog } from "~/components/dialog-warning-action";
import { LoadingSpinner } from "~/components/loading-spinner";
import { Pagination } from "~/components/pagination";
import type { MangaType } from "~/database/models/manga.model";
import { usePagination } from "~/hooks/use-pagination";

interface ProfileMangaFollowProps {
  userId?: string;
}

export function ProfileMangaFollow({ userId }: ProfileMangaFollowProps) {
  const queryParams = userId ? { userId } : undefined;

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
    limit: 5,
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
      <div className="text-txt-secondary text-sm font-medium">
        Tổng cộng: {followingMangas.length}
      </div>

      {followingMangas.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-txt-secondary text-sm font-medium">
            Bạn chưa theo dõi truyện nào
          </p>
        </div>
      ) : (
        <>
          <div className="flex w-full flex-col gap-2">
            {followingMangas.map((manga) => (
              <Link
                key={manga.id}
                to={`/manga/${manga.id}`}
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
                {!userId && (
                  <div className="flex items-center justify-center">
                    <StarOff
                      className={`h-5 w-5 cursor-pointer transition-colors ${
                        unfollowFetcher.state === "submitting"
                          ? "text-txt-disabled cursor-not-allowed"
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
                    />
                  </div>
                )}
              </Link>
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
