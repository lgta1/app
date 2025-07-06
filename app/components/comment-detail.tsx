import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  CircleUserRound,
  Flag,
  MessageCircle,
  RotateCcw,
  Send,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";

import ReportDialog from "./dialog-report";
import { Pagination } from "./pagination";

import { LoadingSpinner } from "~/components/loading-spinner";
import { REPORT_TYPE } from "~/constants/report";
import type { CommentType } from "~/database/models/comment.model";
import type { UserType } from "~/database/models/user.model";
import { getTitleImgPath } from "~/helpers/user.helper";
import { formatDistanceToNow } from "~/utils/date.utils";

interface CommentDetailProps {
  mangaId?: string;
  postId?: string;
  isLoggedIn: boolean;
  isAdmin?: boolean;
}

interface CommentTypeWithUser extends Omit<CommentType, "userId"> {
  userId: UserType;
}

interface PaginationState {
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
}

interface LoadingStates {
  creating: boolean;
  deleting: string | null;
  liking: string | null;
  reporting: boolean;
}

// Helper function to format comment content with reply highlighting
const formatCommentContent = (content: string) => {
  const replyPattern = /^Trả lời (.+?):/;
  const match = content.match(replyPattern);

  if (match) {
    const replyText = match[0];
    const restContent = content.slice(replyText.length).trim();

    return (
      <>
        <span className="text-txt-focus font-medium">{replyText}</span>
        {restContent && <span> {restContent}</span>}
      </>
    );
  }

  return content;
};

export default function CommentDetail({
  mangaId,
  postId,
  isLoggedIn,
  isAdmin = false,
}: CommentDetailProps) {
  const [commentContent, setCommentContent] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [reportDialog, setReportDialog] = useState<{
    isOpen: boolean;
    comment: CommentTypeWithUser | null;
  }>({
    isOpen: false,
    comment: null,
  });
  const [comments, setComments] = useState<CommentTypeWithUser[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    totalPages: 1,
    isLoading: false,
    error: null,
  });
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    creating: false,
    deleting: null,
    liking: null,
    reporting: false,
  });

  // Validate props
  if (!mangaId && !postId) {
    throw new Error("Either mangaId or postId must be provided");
  }

  if (mangaId && postId) {
    throw new Error("Cannot provide both mangaId and postId");
  }

  // Load comments function
  const loadComments = useCallback(
    async (page: number = 1) => {
      setPagination((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: "5",
        });

        if (mangaId) {
          params.append("mangaId", mangaId);
        }
        if (postId) {
          params.append("postId", postId);
        }

        const response = await fetch(`/api/comments?${params}`);
        const data = await response.json();

        if (data.success) {
          setComments(data.data || []);
          setPagination((prev) => ({
            ...prev,
            currentPage: data.currentPage || page,
            totalPages: data.totalPages || 1,
            isLoading: false,
          }));
        } else {
          setPagination((prev) => ({
            ...prev,
            error: data.error || "Có lỗi xảy ra",
            isLoading: false,
          }));
        }
      } catch (error) {
        setPagination((prev) => ({
          ...prev,
          error: "Không thể tải bình luận",
          isLoading: false,
        }));
      }
    },
    [mangaId, postId],
  );

  // Load initial comments
  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Create comment function
  const handleSubmitComment = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!commentContent.trim() || !isLoggedIn) {
        return;
      }

      setLoadingStates((prev) => ({ ...prev, creating: true }));

      try {
        const formData = new FormData();
        formData.append("content", commentContent);
        formData.append("intent", "create-comment");

        if (mangaId) {
          formData.append("mangaId", mangaId);
        }
        if (postId) {
          formData.append("postId", postId);
        }

        const response = await fetch("/api/comments", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (data.success) {
          // Optimistic update: reload only first page to show new comment
          if (pagination.currentPage === 1) {
            await loadComments(1);
          } else {
            // If not on first page, go to first page to show new comment
            await loadComments(1);
          }

          setCommentContent("");
          setReplyTo(null);

          if (data.expReward) {
            toast.success(data.expReward.message);
          }
        } else {
          toast.error(data.error || "Không thể tạo bình luận");
        }
      } catch (error) {
        toast.error("Có lỗi xảy ra khi tạo bình luận");
      } finally {
        setLoadingStates((prev) => ({ ...prev, creating: false }));
      }
    },
    [commentContent, isLoggedIn, mangaId, postId, pagination.currentPage, loadComments],
  );

  // Delete comment function
  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!isAdmin) return;

      const confirmed = window.confirm("Bạn có chắc chắn muốn xóa bình luận này?");
      if (!confirmed) return;

      setLoadingStates((prev) => ({ ...prev, deleting: commentId }));

      try {
        const formData = new FormData();
        formData.append("commentId", commentId);
        formData.append("intent", "delete-comment");

        const response = await fetch("/api/comments", {
          method: "DELETE",
          body: formData,
        });

        const data = await response.json();

        if (data.success) {
          // Optimistic update: remove comment from local state
          setComments((prev) => prev.filter((comment) => comment.id !== commentId));
          toast.success(data.message);
        } else {
          toast.error(data.error || "Không thể xóa bình luận");
        }
      } catch (error) {
        toast.error("Có lỗi xảy ra khi xóa bình luận");
      } finally {
        setLoadingStates((prev) => ({ ...prev, deleting: null }));
      }
    },
    [isAdmin],
  );

  // Like comment function
  const handleLikeComment = useCallback(
    async (commentId: string) => {
      if (!isLoggedIn) return;

      setLoadingStates((prev) => ({ ...prev, liking: commentId }));

      try {
        const formData = new FormData();
        formData.append("commentId", commentId);
        formData.append("intent", "like-comment");

        const response = await fetch("/api/comments", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (data.success) {
          // Update with actual like count from server
          setComments((prev) =>
            prev.map((comment) => {
              if (comment.id === commentId) {
                return { ...comment, likeNumber: data.newLikeCount };
              }
              return comment;
            }),
          );
          toast.success(data.message);
        } else {
          // Revert optimistic update on error
          setComments((prev) =>
            prev.map((comment) => {
              if (comment.id === commentId) {
                return {
                  ...comment,
                  likeNumber: Math.max(0, (comment.likeNumber || 0) - 1),
                };
              }
              return comment;
            }),
          );
          toast.error(data.error || "Không thể thích bình luận");
        }
      } catch (error) {
        // Revert optimistic update on error
        setComments((prev) =>
          prev.map((comment) => {
            if (comment.id === commentId) {
              return {
                ...comment,
                likeNumber: Math.max(0, (comment.likeNumber || 0) - 1),
              };
            }
            return comment;
          }),
        );
        toast.error("Có lỗi xảy ra khi thích bình luận");
      } finally {
        setLoadingStates((prev) => ({ ...prev, liking: null }));
      }
    },
    [isLoggedIn],
  );

  // Report comment function
  const handleSubmitReport = useCallback(
    async (reason: string) => {
      setLoadingStates((prev) => ({ ...prev, reporting: true }));

      try {
        const formData = new FormData();
        formData.append("intent", "create-report");
        formData.append("reason", reason);
        formData.append("targetId", reportDialog.comment?.id || "");
        formData.append("targetName", reportDialog.comment?.userId.name || "");
        formData.append("reportType", REPORT_TYPE.COMMENT);

        if (mangaId) {
          formData.append("mangaId", mangaId);
        }
        if (postId) {
          formData.append("postId", postId);
        }

        const response = await fetch("/api/reports", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (data.success) {
          setReportDialog({ isOpen: false, comment: null });
          toast.success("Báo cáo đã được gửi thành công");
        } else {
          toast.error(data.error || "Không thể gửi báo cáo");
        }
      } catch (error) {
        toast.error("Có lỗi xảy ra khi gửi báo cáo");
      } finally {
        setLoadingStates((prev) => ({ ...prev, reporting: false }));
      }
    },
    [reportDialog.comment, mangaId, postId],
  );

  // Helper functions
  const handleReply = useCallback((comment: CommentTypeWithUser) => {
    const replyText = `Trả lời ${comment.userId?.name}: `;
    setCommentContent(replyText);
    setReplyTo({ id: comment.id, name: comment.userId?.name });

    // Focus on textarea
    const textarea = document.querySelector("textarea");
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(replyText.length, replyText.length);
    }
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
    setCommentContent("");
  }, []);

  const handleReportComment = useCallback(
    (comment: CommentTypeWithUser) => {
      if (!isLoggedIn) return;
      setReportDialog({ isOpen: true, comment });
    },
    [isLoggedIn],
  );

  const handleCloseReportDialog = useCallback(() => {
    setReportDialog({ isOpen: false, comment: null });
  }, []);

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= pagination.totalPages && page !== pagination.currentPage) {
        loadComments(page);
      }
    },
    [pagination.totalPages, pagination.currentPage, loadComments],
  );

  return (
    <div className="mt-8 flex flex-col items-start justify-start gap-6 self-stretch">
      {/* Header */}
      <div className="border-bd-default flex items-center justify-between self-stretch border-b pb-3">
        <div className="flex items-center justify-start gap-3">
          <div className="relative h-[15px] w-[15px]">
            <img
              src="/images/icons/multi-star.svg"
              alt=""
              className="absolute top-0 left-[4.62px] h-4"
            />
          </div>
          <div className="text-txt-primary font-sans text-xl leading-7 font-semibold uppercase">
            bình luận
          </div>
        </div>

        {/* Reload Button */}
        <button
          onClick={() => loadComments(pagination.currentPage)}
          disabled={pagination.isLoading}
          className="text-txt-focus border-lav-500 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          title="Tải lại bình luận mới nhất"
        >
          <RotateCcw
            className={`h-4 w-4 ${pagination.isLoading ? "animate-spin" : ""}`}
          />
          {pagination.isLoading ? "Đang tải..." : "Tải lại"}
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col items-center justify-center gap-10 self-stretch">
        {/* Comment Input */}
        {isLoggedIn ? (
          <form onSubmit={handleSubmitComment} className="w-full">
            <div className="bg-bgc-layer2 border-bd-default flex flex-col items-start justify-start gap-3 self-stretch overflow-hidden rounded-xl border-b p-3">
              {/* Reply indicator */}
              {replyTo && (
                <div className="bg-bgc-layer1 border-bd-default flex w-full items-center justify-between rounded-lg border p-2">
                  <div className="text-txt-focus font-sans text-sm font-medium">
                    Đang trả lời {replyTo.name}
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelReply}
                    className="text-txt-secondary hover:text-txt-primary transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <textarea
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                placeholder="Mời bạn vào thảo luận về truyện..."
                className="text-txt-primary placeholder:text-txt-secondary min-h-[60px] w-full resize-none bg-transparent font-sans text-sm leading-tight font-medium outline-none"
                maxLength={1000}
              />
              <div className="flex w-full items-center justify-between">
                <div className="text-txt-secondary font-sans text-xs">
                  {commentContent.length}/1000 ký tự
                </div>
                <button
                  type="submit"
                  disabled={!commentContent.trim() || loadingStates.creating}
                  className="bg-btn-primary text-txt-primary hover:bg-btn-primary/80 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {loadingStates.creating ? "Đang gửi..." : "Gửi"}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="bg-bgc-layer2 border-bd-default flex h-28 flex-col items-center justify-center gap-1.5 self-stretch overflow-hidden rounded-xl border-b p-3">
            <div className="text-txt-secondary font-sans text-sm leading-tight font-medium">
              Vui lòng đăng nhập để bình luận
            </div>
          </div>
        )}

        {/* Comments Section */}
        <div className="flex flex-col items-center justify-start gap-6 self-stretch">
          {/* Comments List */}
          <div className="flex flex-col items-start justify-start gap-6 self-stretch">
            {pagination.isLoading ? (
              <div className="flex w-full justify-center py-4">
                <LoadingSpinner />
              </div>
            ) : pagination.error ? (
              <div className="py-8 text-center font-sans text-sm text-red-500">
                {pagination.error}
              </div>
            ) : comments.length > 0 ? (
              comments.map((comment: CommentTypeWithUser) => (
                <div
                  key={comment.id}
                  className="flex items-start justify-start gap-4 self-stretch"
                >
                  {/* Avatar */}
                  {comment.userId?.avatar ? (
                    <img
                      className="mt-1.5 h-10 w-10 flex-shrink-0 rounded-full"
                      src={comment.userId?.avatar}
                      alt={`${comment.userId?.name} avatar`}
                    />
                  ) : (
                    <CircleUserRound className="mt-1.5 h-10 w-10 flex-shrink-0" />
                  )}

                  {/* Comment Content */}
                  <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-2">
                    {/* Comment Card */}
                    <div className="bg-bgc-layer1 border-bd-default flex flex-col items-start justify-start self-stretch overflow-hidden rounded-lg border">
                      {/* Comment Header */}
                      <div className="bg-bgc-layer2 border-bd-default flex flex-col items-start justify-start gap-1.5 self-stretch overflow-hidden border-b p-3">
                        <div className="flex items-center justify-between self-stretch">
                          <div className="flex items-center justify-start gap-2">
                            <div className="text-txt-primary font-sans text-sm leading-tight font-medium">
                              {comment.userId?.name}
                            </div>
                            <img
                              className="h-7"
                              src={getTitleImgPath(comment.userId)}
                              alt="User badge"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleReportComment(comment)}
                              disabled={!isLoggedIn || loadingStates.reporting}
                              className="relative h-4 flex-shrink-0 cursor-pointer overflow-hidden transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                              title={
                                isLoggedIn ? "Báo cáo bình luận" : "Đăng nhập để báo cáo"
                              }
                            >
                              <Flag className="text-txt-secondary h-full" />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                disabled={loadingStates.deleting === comment.id}
                                className="relative h-4 flex-shrink-0 overflow-hidden text-red-500 transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                title="Xóa bình luận"
                              >
                                <Trash2 className="h-full" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Comment Body */}
                      <div className="flex items-center justify-center gap-2.5 self-stretch p-3">
                        <div className="text-txt-primary flex-1 font-sans text-sm leading-tight font-medium">
                          {formatCommentContent(comment.content)}
                        </div>
                      </div>
                    </div>

                    {/* Comment Actions */}
                    <div className="flex flex-wrap items-center justify-start gap-6">
                      <button
                        onClick={() => handleLikeComment(comment.id)}
                        disabled={!isLoggedIn || loadingStates.liking === comment.id}
                        className="flex cursor-pointer items-center justify-start gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                        title={isLoggedIn ? "Thích bình luận" : "Đăng nhập để thích"}
                      >
                        <ThumbsUp className="text-txt-focus h-4 w-5" />
                        <div className="text-txt-focus font-sans text-base leading-normal font-medium">
                          {comment.likeNumber || 0}
                        </div>
                      </button>
                      <button
                        onClick={() => handleReply(comment)}
                        disabled={!isLoggedIn}
                        className="flex cursor-pointer items-center justify-start gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <MessageCircle className="text-txt-focus h-5 w-5" />
                        <div className="text-txt-focus font-sans text-base leading-normal font-medium">
                          Trả lời
                        </div>
                      </button>
                      <div className="text-txt-secondary font-sans text-base leading-normal font-medium">
                        {formatDistanceToNow(comment.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-txt-secondary py-8 text-center font-sans text-sm">
                Chưa có bình luận nào. Hãy là người đầu tiên bình luận!
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                onPageChange={goToPage}
              />
            </div>
          )}
        </div>
      </div>

      {/* Report Dialog */}
      <ReportDialog
        isOpen={reportDialog.isOpen}
        onClose={handleCloseReportDialog}
        onSubmit={handleSubmitReport}
      />
    </div>
  );
}
