import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router-dom";
import { Edit, Eye, Heart, Plus, Trash2 } from "lucide-react";

import { WarningActionDialog } from "~/components/dialog-warning-action";
import { LoadingSpinner } from "~/components/loading-spinner";
import { Pagination } from "~/components/pagination";
import { MANGA_STATUS } from "~/constants/manga";
import type { MangaType } from "~/database/models/manga.model";
import { usePagination } from "~/hooks/use-pagination";

interface ProfileMangaUploadedProps {
  userId?: string;
}

export function ProfileMangaUploaded({ userId }: ProfileMangaUploadedProps) {
  const queryParams = userId ? { userId } : undefined;

  const {
    data: uploadedMangas,
    currentPage,
    totalPages,
    isLoading,
    error,
    goToPage,
    refresh,
  } = usePagination<MangaType>({
    apiUrl: "/api/manga/uploaded", // API endpoint cần tạo
    limit: 5,
    queryParams,
  });

  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    mangaId: "",
  });

  const deleteFetcher = useFetcher();

  const handleDelete = (mangaId: string) => {
    const formData = new FormData();
    formData.append("intent", "delete");
    formData.append("mangaId", mangaId);

    deleteFetcher.submit(formData, {
      method: "DELETE",
      action: "/api/manga",
    });
  };

  // Refresh data when delete is successful
  useEffect(() => {
    if (deleteFetcher.data?.success && deleteFetcher.state === "idle") {
      refresh();
    }
  }, [deleteFetcher.data, deleteFetcher.state]);

  const getStatusText = (status: number) => {
    switch (status) {
      case MANGA_STATUS.PENDING:
        return "Chờ duyệt";
      case MANGA_STATUS.APPROVED:
        return "Đã duyệt";
      case MANGA_STATUS.REJECTED:
        return "Bị từ chối";
      default:
        return "Không xác định";
    }
  };

  const getStatusStyle = (status: number) => {
    switch (status) {
      case MANGA_STATUS.PENDING:
        return "bg-[#FFE133]/10 text-[#FFE133]";
      case MANGA_STATUS.APPROVED:
        return "bg-[#25EBAC]/10 text-[#25EBAC]";
      case MANGA_STATUS.REJECTED:
        return "bg-red-500/10 text-red-500";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
  };

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
      {/* Header với tổng số và button đăng truyện */}
      <div className="flex w-full items-center justify-between">
        <div className="text-txt-secondary text-sm font-medium">
          Tổng cộng: {uploadedMangas.length}
        </div>
        {!userId && (
          <Link
            to="/manga/create"
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 text-sm font-semibold text-black shadow-[0px_4px_8.9px_0px_rgba(196,69,255,0.25)] transition-all hover:opacity-90"
          >
            <Plus className="h-5 w-5" />
            Đăng truyện
          </Link>
        )}
      </div>

      {uploadedMangas.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-txt-secondary text-sm font-medium">
            Bạn chưa đăng truyện nào
          </p>
        </div>
      ) : (
        <>
          <div className="flex w-full flex-col gap-2">
            {uploadedMangas.map((manga) => (
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
                    <div className="flex items-center gap-1">
                      <h3 className="text-txt-primary line-clamp-1 text-sm leading-tight font-medium">
                        {manga.title}
                      </h3>
                      <span
                        className={`rounded-[32px] px-2 py-1 text-xs font-medium backdrop-blur-[3.4px] ${getStatusStyle(manga.status)}`}
                      >
                        {getStatusText(manga.status)}
                      </span>
                    </div>
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
                  <div className="flex items-center gap-2">
                    <Link to={`/manga/preview/${manga.id}`}>
                      <Edit className="h-5 w-5 cursor-pointer text-[#25EBAC] transition-colors hover:text-[#25EBAC]/80" />
                    </Link>
                    <Trash2
                      className={`h-5 w-5 cursor-pointer transition-colors ${
                        deleteFetcher.state === "submitting"
                          ? "text-txt-disabled cursor-not-allowed"
                          : "text-txt-secondary hover:text-error-error"
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        if (deleteFetcher.state !== "submitting") {
                          setDeleteDialog({
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

      {/* Delete Dialog */}
      <WarningActionDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        title="Xóa truyện?"
        message="Hành động này không thể hoàn tác. Bạn có muốn tiếp tục?"
        confirmText="Vẫn xóa"
        cancelText="Trở về"
        onConfirm={() => handleDelete(deleteDialog.mangaId)}
        reverseAction
      />
    </div>
  );
}
