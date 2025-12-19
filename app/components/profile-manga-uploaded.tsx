import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router-dom";
import { Edit, Eye, Heart, Plus, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";

import { WarningActionDialog } from "~/components/dialog-warning-action";
import { LoadingSpinner } from "~/components/loading-spinner";
import { Pagination } from "~/components/pagination";
import { MANGA_STATUS, MANGA_USER_STATUS } from "~/constants/manga";
import type { MangaType } from "~/database/models/manga.model";
import { usePagination } from "~/hooks/use-pagination";
import { buildMangaUrl } from "~/utils/manga-url.utils";

interface ProfileMangaUploadedProps {
  userId?: string;
}

const PAGE_LIMIT = 5;
const MAX_TITLE_LENGTH = 40;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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
    responseMeta,
  } = usePagination<MangaType>({
    apiUrl: "/api/manga/uploaded", // API endpoint cần tạo
    limit: PAGE_LIMIT,
    queryParams,
  });

  const [deleteDialog, setDeleteDialog] = useState({ open: false, mangaId: "" });
  // Đếm số lượng chương thực tế mỗi truyện (API trả về manga.chapters nhưng đảm bảo lấy đúng / linh hoạt nếu thay đổi)
  const [chapterCounts, setChapterCounts] = useState<Record<string, number>>({});

  const deleteFetcher = useFetcher();

  const totalUploadedCount =
    typeof responseMeta?.totalUploaded === "number" ? responseMeta.totalUploaded : null;
  const totalViewsValue =
    typeof responseMeta?.totalViews === "number"
      ? responseMeta.totalViews
      : uploadedMangas.reduce((sum, manga) => sum + (manga.viewNumber || 0), 0);
  const totalViewsText = totalViewsValue.toLocaleString();
  const isAdminUser = Boolean(responseMeta?.isAdminUser);

  const handleDelete = (mangaId: string) => {
    const formData = new FormData();
    formData.append("intent", "delete");
    formData.append("mangaId", mangaId);

    deleteFetcher.submit(formData, {
      method: "DELETE",
      action: "/api/manga",
    });
  };

  // Refresh data when delete is successful / show error otherwise
  useEffect(() => {
    if (deleteFetcher.state !== "idle" || !deleteFetcher.data) return;
    if (deleteFetcher.data.success) {
      refresh();
    } else if (deleteFetcher.data.error) {
      toast.error(deleteFetcher.data.error);
    }
  }, [deleteFetcher.data, deleteFetcher.state, refresh]);

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

  // Lấy tổng số chương cho mỗi truyện hiển thị (nhẹ vì limit nhỏ)
  useEffect(() => {
    const fetchCounts = async () => {
      const targets = uploadedMangas.filter((m) => !chapterCounts[m.id]);
      if (!targets.length) return;
      const entries = await Promise.all(
        targets.map(async (m) => {
          try {
            const r = await fetch(`/api/chapters.list?mangaId=${m.id}`);
            const j = await r.json();
            const count = Array.isArray(j?.chapters) ? j.chapters.length : m.chapters ?? 0;
            return [m.id, count] as [string, number];
          } catch {
            return [m.id, m.chapters ?? 0] as [string, number];
          }
        })
      );
      setChapterCounts((prev) => {
        const next = { ...prev };
        for (const [id, c] of entries) next[id] = c;
        return next;
      });
    };
    if (!isLoading && uploadedMangas.length) fetchCounts();
  }, [uploadedMangas, isLoading, chapterCounts]);

  const truncateTitle = (title: string) => {
    if (!title) return "";
    if (title.length <= MAX_TITLE_LENGTH) return title;
    return `${title.slice(0, MAX_TITLE_LENGTH - 3).trimEnd()}...`;
  };

  const getCreatedAtDate = (value: unknown) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    const parsed = new Date(value as string);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };

  const getUserStatusInfo = (status?: number) => {
    if (status === MANGA_USER_STATUS.COMPLETED) {
      return {
        label: "Đã hoàn thành",
        style: "bg-green-500/10 text-green-400",
      };
    }
    return {
      label: "Đang tiến hành",
      style: "bg-red-500/10 text-red-400",
    };
  };

  const canDeleteManga = (manga: MangaType) => {
    if (isAdminUser) return true;
    const createdAtDate = getCreatedAtDate(manga?.createdAt);
    if (!createdAtDate) return false;
    return Date.now() - createdAtDate.getTime() <= SEVEN_DAYS_MS;
  };

  const getSttValue = (index: number) => {
    if (typeof totalUploadedCount === "number" && totalUploadedCount > 0) {
      const globalIndex = (currentPage - 1) * PAGE_LIMIT + index;
      return Math.max(1, totalUploadedCount - globalIndex);
    }
    return (currentPage - 1) * PAGE_LIMIT + index + 1;
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
          tổng số view bạn kiếm được từ mọi truyện: {totalViewsText}
        </div>
        {!userId && (
          <Link
            to="/truyen-hentai/create"
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 text-sm font-semibold text-black shadow-[0px_4px_8.9px_0px_rgba(196,69,255,0.25)] transition-all hover:opacity-90"
          >
            <Plus className="h-5 w-5" />
            Tạo truyện mới
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
            {uploadedMangas.map((manga, index) => {
              const sttValue = getSttValue(index);
              const { label: userStatusLabel, style: userStatusStyle } =
                getUserStatusInfo(manga.userStatus);
              const truncatedTitle = truncateTitle(manga.title);
              const canDelete = canDeleteManga(manga);
              const previewHandle = manga.slug || manga.id;

              return (
                <Link
                  key={manga.id}
                  to={buildMangaUrl(manga)}
                  className="bg-bgc-layer1 border-bd-default flex w-full items-center justify-between rounded-xl border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex w-12 flex-col items-center">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-txt-secondary">
                        STT
                      </span>
                      <span className="text-lg font-bold text-white">{sttValue}</span>
                    </div>
                    <img
                      className="h-24 w-16 rounded object-cover"
                      src={manga.poster}
                      alt={manga.title}
                    />
                    <div className="flex flex-1 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-1">
                        <h3
                          className="text-txt-primary line-clamp-1 text-sm leading-tight font-medium"
                          title={manga.title}
                        >
                          {truncatedTitle}
                        </h3>
                        <span className={`rounded-[32px] px-2 py-1 text-xs font-medium backdrop-blur-[3.4px] ${getStatusStyle(manga.status)}`}>
                          {getStatusText(manga.status)}
                        </span>
                        <span
                          className={`rounded-[32px] px-2 py-1 text-xs font-medium backdrop-blur-[3.4px] ${userStatusStyle}`}
                        >
                          {userStatusLabel}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-start gap-2">
                        <span className="text-txt-focus text-xs font-medium">
                          Số lượng chap: {chapterCounts[manga.id] ?? manga.chapters}
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
                      <Link
                        to={`/truyen-hentai/preview/${previewHandle}`}
                        className="flex items-center gap-1.5 rounded-lg border border-[#25EBAC] px-2.5 py-1.5 text-sm font-medium text-[#25EBAC] transition-colors hover:bg-[#25EBAC]/10"
                      >
                        <Edit className="h-4 w-4" />
                        <span>Chỉnh sửa/Thêm chương mới</span>
                      </Link>
                      <Trash2
                        className={`h-5 w-5 transition-colors ${
                          deleteFetcher.state === "submitting"
                            ? "text-txt-disabled cursor-not-allowed"
                            : canDelete
                              ? "text-txt-secondary hover:text-error-error cursor-pointer"
                              : "text-txt-disabled cursor-not-allowed"
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          if (deleteFetcher.state === "submitting") return;
                          if (!canDelete) {
                            toast.error(
                              "Bạn không thể xoá truyện đã đăng quá 7 ngày. Chỉ admin có thể xoá.",
                            );
                            return;
                          }
                          setDeleteDialog({
                            open: true,
                            mangaId: manga.id,
                          });
                        }}
                        title={
                          canDelete
                            ? "Xóa truyện"
                            : "Bạn không thể xoá truyện đã đăng quá 7 ngày. Chỉ admin có thể xoá."
                        }
                      />
                    </div>
                  )}
                </Link>
              );
            })}
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
