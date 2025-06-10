import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
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
import { InfinityLoadingTrigger } from "./infinity-loading-trigger";

import { REPORT_TYPE } from "~/constants/report";
import type { CommentType } from "~/database/models/comment.model";
import type { UserType } from "~/database/models/user.model";
import { getTitleImgPath } from "~/helpers/user.helper";
import { usePaginatedLoading } from "~/hooks/use-paginated-loading";
import { formatDistanceToNow } from "~/utils/date.utils";

interface CommentDetailProps {
  mangaId: string;
  isLoggedIn: boolean;
  isAdmin?: boolean;
}

interface CommentTypeWithUser extends Omit<CommentType, "userId"> {
  userId: UserType;
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

  const {
    allData: allComments,
    hasMore,
    isLoadingMore,
    isReloading,
    isInitialLoading,
    handleLoadMore,
    handleReload,
    addNewItem: addNewComment,
    // updateItem: updateComment,
    removeItem,
  } = usePaginatedLoading<CommentTypeWithUser>({
    endpoint: "/api/comments",
    initialData: [],
    limit: 5,
    queryParams: { mangaId },
  });

  const createCommentFetcher = useFetcher();
  const deleteCommentFetcher = useFetcher();
  const reportFetcher = useFetcher();

  // Cập nhật danh sách comment khi có comment mới được tạo
  useEffect(() => {
    if (createCommentFetcher.data && createCommentFetcher.data.success) {
      addNewComment(createCommentFetcher.data.comment);
    }
  }, [createCommentFetcher.data, addNewComment]);

  // Xử lý khi xóa comment thành công
  useEffect(() => {
    if (deleteCommentFetcher.data && deleteCommentFetcher.data.success) {
      const deletedCommentId = deleteCommentFetcher.data.commentId;
      if (deletedCommentId) {
        removeItem((comment) => comment.id === deletedCommentId);
      }
    }
  }, [deleteCommentFetcher.data, removeItem]);

  // Xử lý khi gửi report thành công
  useEffect(() => {
    if (reportFetcher.data && reportFetcher.data.success) {
      setReportDialog({ isOpen: false, comment: null });
      // Có thể thêm toast notification ở đây
    }
  }, [reportFetcher.data]);

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();

    if (!commentContent.trim() || !isLoggedIn) {
      return;
    }

    createCommentFetcher.submit(
      {
        content: commentContent,
        mangaId,
        intent: "create-comment",
      },
      {
        method: "POST",
        action: `/api/comments`,
      },
    );

    setCommentContent("");
    setReplyTo(null);
  };

  const handleReply = (comment: any) => {
    const replyText = `Trả lời ${comment.userId?.name}: `;
    setCommentContent(replyText);
    setReplyTo({ id: comment.id, name: comment.userId?.name });

    // Focus on textarea
    const textarea = document.querySelector("textarea");
    if (textarea) {
      textarea.focus();
      // Set cursor position at the end
      textarea.setSelectionRange(replyText.length, replyText.length);
    }
  };

  const handleCancelReply = () => {
    setReplyTo(null);
    setCommentContent("");
  };

  const handleDeleteComment = (commentId: string) => {
    if (!isAdmin) return;

    const confirmed = window.confirm("Bạn có chắc chắn muốn xóa bình luận này?");
    if (!confirmed) return;

    deleteCommentFetcher.submit(
      {
        commentId,
        intent: "delete-comment",
      },
      {
        method: "DELETE",
        action: `/api/comments`,
      },
    );
  };

  const handleReportComment = (comment: CommentTypeWithUser) => {
    if (!isLoggedIn) return;

    setReportDialog({
      isOpen: true,
      comment,
    });
  };

  const handleSubmitReport = (reason: string) => {
    reportFetcher.submit(
      {
        intent: "create-report",
        reason,
        targetId: reportDialog.comment?.id || "",
        targetName: reportDialog.comment?.userId.name || "",
        reportType: REPORT_TYPE.COMMENT,
        mangaId,
      },
      {
        method: "POST",
        action: "/api/reports",
      },
    );
  };

  const handleCloseReportDialog = () => {
    setReportDialog({ isOpen: false, comment: null });
  };

  return (
    <div className="mt-8 flex flex-col items-start justify-start gap-6 self-stretch">
      {/* Header */}
      <div className="border-bd-default flex items-center justify-between self-stretch border-b pb-3">
        <div className="flex items-center justify-start gap-3">
          <div className="relative h-[15px] w-[15px]">
            <img
              src="/images/home/star-icon-1.svg"
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
          onClick={handleReload}
          disabled={isReloading}
          className="text-txt-focus border-lav-500 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          title="Tải lại bình luận mới nhất"
        >
          <RotateCcw className={`h-4 w-4 ${isReloading ? "animate-spin" : ""}`} />
          {isReloading ? "Đang tải..." : "Tải lại"}
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
                  disabled={
                    !commentContent.trim() || createCommentFetcher.state === "submitting"
                  }
                  className="bg-btn-primary text-txt-primary hover:bg-btn-primary/80 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {createCommentFetcher.state === "submitting" ? "Đang gửi..." : "Gửi"}
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
            {isInitialLoading ? (
              <div className="text-txt-secondary py-8 text-center font-sans text-sm">
                Đang tải bình luận...
              </div>
            ) : allComments.length > 0 ? (
              allComments.map((comment: CommentTypeWithUser) => (
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
                              disabled={
                                !isLoggedIn || reportFetcher.state === "submitting"
                              }
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
                                disabled={deleteCommentFetcher.state === "submitting"}
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
                      <div className="flex items-center justify-start gap-1.5">
                        <ThumbsUp className="text-txt-focus h-4 w-5" />
                        <div className="text-txt-focus font-sans text-base leading-normal font-medium">
                          {comment.likeNumber || 0}
                        </div>
                      </div>
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

          {/* Infinity Loading Trigger */}
          <InfinityLoadingTrigger
            isAutoLoad={false}
            isLoading={isLoadingMore}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
          />
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
