import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  User as UserIcon,
  Flag,
  MessageCircle,
  MessagesSquare,
  MessageSquare,
  RotateCcw,
  Send,
  Image as ImageIcon,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";

import ReportDialog from "./dialog-report";
import { isDichGia } from "~/helpers/user.helper";
import GifMemeDialog from "./dialog-gif-meme";
import { Pagination } from "./pagination";

import WaifuMeta from "~/components/common/WaifuMeta";
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
  parentId?: string;
  replies?: CommentTypeWithUser[];
  replyCount?: number;
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
  loadingReplies: string | null;
}

interface ReplyVisibilityState {
  [commentId: string]: boolean;
}

/* ===========================
 * Config màu
 * =========================== */
// NEW: dùng tím-350 cho @mention (nhạt hơn toggle tím-400)
const MENTION_CLASS = "font-semibold text-[#B39AFB]";

/* ===========================
 * Preview Modal (mobile tap)
 * =========================== */
function PreviewModal({
  user,
  onClose,
}: {
  user: UserType | null;
  onClose: () => void;
}) {
  if (!user) return null;
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative rounded-xl bg-bgc-layer1 p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-2 top-2 rounded-full p-1 text-txt-secondary hover:text-txt-primary focus:outline-none"
          aria-label="Đóng"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-4">
          <WaifuMeta filename={(user as any)?.waifuFilename ?? null} height={160} />
          <div className="flex flex-col">
            <div className="text-lg font-semibold">{user.name}</div>
            <img src={getTitleImgPath(user)} alt="User badge" className="mt-2 h-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===========================
 * Helpers
 * =========================== */
const getProfilePath = (u?: UserType) => (u?.id ? `/profile/${u.id}` : "/profile");

/** Hiển thị tím cho:
 *  - legacy “Trả lời Name: …” (render thành @Name)
 *  - markup mới “@[Name] …” (render thành @Name)
 *  - fallback “@Name …” (nếu có)
 */
const renderReplyContent = (raw: string) => {
  if (!raw) return raw;
  const content = raw.replace(/^\s+/, "");

  // Case 1: legacy "Trả lời Name: ..."
  const PREFIX = "Trả lời ";
  if (content.startsWith(PREFIX)) {
    const colonIdx = content.indexOf(":");
    if (colonIdx > PREFIX.length) {
      const name = content.slice(PREFIX.length, colonIdx).trim();
      const rest = content.slice(colonIdx + 1).trim();
      return (
        <span className="text-txt-primary">
          <span className={MENTION_CLASS}>@{name}</span>
          {rest ? ` ${rest}` : ""}
        </span>
      );
    }
  }

  // Case 2: markup mới "@[Name] ..."
  const bracket = content.match(/^@\[(.+?)\]\s?(.*)$/);
  if (bracket) {
    const name = bracket[1];
    const rest = bracket[2] ?? "";
    return (
      <span className="text-txt-primary">
        <span className={MENTION_CLASS}>@{name}</span>
        {rest ? ` ${rest}` : ""}
      </span>
    );
  }

  // Case 3 (fallback): bắt đầu bằng "@Something ..." — tô tím token đầu
  const simple = content.match(/^@(\S+)\s?(.*)$/);
  if (simple) {
    const part = simple[1];
    const rest = simple[2] ?? "";
    return (
      <span className="text-txt-primary">
        <span className={MENTION_CLASS}>@{part}</span>
        {rest ? ` ${rest}` : ""}
      </span>
    );
  }

  return content;
};

/* ===========================
 * Inline composer kiểu YouTube (một dòng kẻ, 1 ô duy nhất)
 * NEW: dùng contentEditable để hiển thị @Tên tím-350 NGAY TRONG Ô (không còn chip riêng)
 *      Khi gửi, nếu có prefill, sẽ chuẩn hoá nội dung thành: "@[Name] " + phần còn lại
 * =========================== */
function InlineComposerLine({
  onSubmit,
  onCancel,
  disabled,
  placeholder = "Viết phản hồi...",
  initialMentionName = "",
}: {
  onSubmit: (value: string) => void;
  onCancel: () => void;
  disabled?: boolean;
  placeholder?: string;
  initialMentionName?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hasInit, setHasInit] = useState(false);
  const [replyGif, setReplyGif] = useState<string | null>(null);
  const [gifOpen, setGifOpen] = useState(false);

  // Khởi tạo nội dung: nếu có tên → prefill "@Name " dưới dạng span tím ngay trong ô
  useEffect(() => {
    if (!ref.current || hasInit) return;
    setHasInit(true);
    if (initialMentionName) {
      ref.current.innerHTML = `<span class="${MENTION_CLASS}">@${initialMentionName}</span>&nbsp;`;
      // đặt caret cuối nội dung
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    } else {
      ref.current.innerHTML = "";
    }
  }, [initialMentionName, hasInit]);

  const getPlainText = () => {
    const el = ref.current;
    if (!el) return "";
    return el.textContent ?? "";
  };

  const handleSend = () => {
    if (disabled) return;
    const txt = getPlainText().replace(/\u00A0/g, " "); // NBSP -> space
    const trimmed = txt.trim();

    // Không gửi nếu cả text rỗng và không có GIF
    if (!trimmed && !replyGif) return;

    let base = trimmed;
    // Nếu có prefill và người dùng không xoá đầu đề cập → chuẩn hoá thành "@[Name] ..."
    if (initialMentionName && trimmed) {
      const expectedPrefix = `@${initialMentionName}`;
      if (trimmed.startsWith(expectedPrefix)) {
        const rest = trimmed.slice(expectedPrefix.length).replace(/^\s+/, "");
        base = `@[${initialMentionName}] ${rest}`.trim();
      }
    }

    const payload = [base, replyGif ?? ""].filter(Boolean).join("\n");
    onSubmit(payload);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // single-line
      handleSend();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="mt-2 w-full">
      {/* 1 ô duy nhất, dạng underline */}
      <div
        ref={ref}
        role="textbox"
        contentEditable
        aria-multiline={false}
        data-placeholder={placeholder}
        onKeyDown={handleKeyDown}
        className={`
          w-full bg-transparent outline-none
          border-b border-txt-secondary
          focus:border-txt-primary
          text-sm font-medium text-txt-primary
          pb-1
          [white-space:pre-wrap] [word-break:break-word]
          empty:before:text-txt-secondary empty:before:content-[attr(data-placeholder)]
        `}
        style={{ minHeight: "1.75rem" }}
        suppressContentEditableWarning
      />
      {/* preview GIF nếu có */}
      {replyGif && (
        <div className="mt-2 flex items-center gap-2">
          <img
            src={replyGif}
            alt="GIF"
            className="h-16 w-auto max-w-[120px] rounded-md border border-bd-default object-cover"
            loading="lazy"
            decoding="async"
          />
          <button
            type="button"
            onClick={() => setReplyGif(null)}
            className="text-xs text-txt-secondary hover:text-txt-primary"
          >
            Gỡ GIF
          </button>
        </div>
      )}

      {/* hành động bên phải, nhỏ gọn */}
      <div className="mt-2 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setGifOpen(true)}
          className="text-txt-secondary hover:text-txt-primary"
          title="Chèn GIF"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-txt-secondary hover:text-txt-primary"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={handleSend}
          className="
            rounded-full px-4 py-1.5 text-sm font-semibold
            bg-btn-primary text-txt-primary
            hover:bg-btn-primary/80 disabled:opacity-50
          "
          disabled={disabled}
        >
          Gửi
        </button>
      </div>

      {/* Dialog chọn GIF cho reply */}
      <GifMemeDialog
        isOpen={gifOpen}
        onClose={() => setGifOpen(false)}
        onSelect={(url) => {
          // chỉ 1 GIF cho reply: thay thế nếu đã chọn
          setReplyGif(url);
          setGifOpen(false);
        }}
      />
    </div>
  );
}

/* ===========================
 * Component chính
 * =========================== */
export default function CommentDetail({
  mangaId,
  postId,
  isLoggedIn,
  isAdmin = false,
}: CommentDetailProps) {
  const [commentContent, setCommentContent] = useState(""); // composer lớn: bình luận cấp 1
  const [gifDialogOpen, setGifDialogOpen] = useState(false);
  const [composerGifs, setComposerGifs] = useState<string[]>([]); // GIF đính kèm cho composer chính
  const [reportDialog, setReportDialog] = useState<{
    isOpen: boolean;
    comment: CommentTypeWithUser | null;
  }>({ isOpen: false, comment: null });
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
    loadingReplies: null,
  });
  const [replyVisibility, setReplyVisibility] = useState<ReplyVisibilityState>({});
  /** Inline composer: hiển thị ngay dưới item được bấm.
   *  parentId: id comment gốc để POST (theo backend hiện tại)
   *  anchorId: id item (comment/reply) nơi mở composer
   *  prefillName: tên để prefill trong ô (chỉ khi trả lời một reply)
   */
  const [activeComposer, setActiveComposer] = useState<{
    parentId: string;
    anchorId: string;
    replyingTo?: UserType;
    prefillName?: string;
  } | null>(null);

  const [previewUser, setPreviewUser] = useState<UserType | null>(null);
  // Popover waifu (desktop hover / mobile tap)
  const [waifuPopover, setWaifuPopover] = useState<{
    filename: string;
    x: number;
    y: number;
  } | null>(null);
  const isTouch = useMemo(() => {
    if (typeof window === "undefined") return false;
    return matchMedia("(hover: none)").matches;
  }, []);
  const openPreview = useCallback((u?: UserType) => setPreviewUser(u ?? null), []);
  const closePreview = useCallback(() => setPreviewUser(null), []);
  const closeWaifuPopover = useCallback(() => setWaifuPopover(null), []);

  useEffect(() => {
    if (!waifuPopover) return;
    const handler = () => setWaifuPopover(null);
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler, true);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler, true);
    };
  }, [waifuPopover]);

  const handleWaifuHover = (e: React.MouseEvent, filename?: string | null) => {
    if (!filename) return;
    if (isTouch) return; // touch dùng onClick
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setWaifuPopover({
      filename,
      x: rect.left + rect.width / 2,
      y: rect.top - 8, // popover ở trên 1 chút
    });
  };
  const handleWaifuLeave = () => {
    if (isTouch) return; // tránh flicker trên mobile (tap sẽ dùng toggle)
    setWaifuPopover(null);
  };
  const handleWaifuClick = (e: React.MouseEvent, filename?: string | null) => {
    if (!filename) return;
    e.stopPropagation();
    if (!isTouch) return; // desktop chỉ hover
    // toggle
    setWaifuPopover((prev) => (prev ? null : {
      filename,
      x: (e.currentTarget as HTMLElement).getBoundingClientRect().left + (e.currentTarget as HTMLElement).clientWidth / 2,
      y: (e.currentTarget as HTMLElement).getBoundingClientRect().top - 8,
    }));
  };

  // Validate props
  if (!mangaId && !postId) {
    throw new Error("Either mangaId or postId must be provided");
  }
  if (mangaId && postId) {
    throw new Error("Cannot provide both mangaId and postId");
  }

  /* -------- Load comments -------- */
  const loadComments = useCallback(
    async (page: number = 1) => {
      setPagination((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const params = new URLSearchParams({ page: String(page), limit: "5" });
        if (mangaId) params.append("mangaId", mangaId);
        if (postId) params.append("postId", postId);

        const res = await fetch(`/api/comments?${params}`);
        const data = await res.json();
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
      } catch {
        setPagination((prev) => ({
          ...prev,
          error: "Không thể tải bình luận",
          isLoading: false,
        }));
      }
    },
    [mangaId, postId],
  );

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  /* -------- Create comment (composer lớn + inline) -------- */
  const handleSubmitComment = useCallback(
    async (eOrValue: React.FormEvent | string) => {
      let content = "";
      if (typeof eOrValue !== "string") {
        eOrValue.preventDefault();
        // composer lớn: trộn nội dung + GIF (ẩn khỏi textarea)
        const text = commentContent.trim();
        const gifPart = composerGifs.join("\n");
        content = [text, gifPart].filter(Boolean).join("\n");
      } else {
        content = eOrValue;
      }
      if (!content.trim() || !isLoggedIn) return;

      setLoadingStates((prev) => ({ ...prev, creating: true }));
      try {
        const formData = new FormData();
        formData.append("content", content);
        formData.append("intent", "create-comment");
        if (mangaId) formData.append("mangaId", mangaId);
        if (postId) formData.append("postId", postId);

        const parentId = activeComposer?.parentId ?? null;
        if (parentId) formData.append("parentId", parentId);

        const response = await fetch("/api/comments", { method: "POST", body: formData });
        const data = await response.json();

        if (data.success) {
          if (parentId) {
            await loadReplies(parentId);
            setActiveComposer(null);
          } else {
            await loadComments(1);
            setCommentContent("");
            setComposerGifs([]);
          }
          // EXP vẫn cộng bình thường (giữ im thông báo)
          // if (data.expReward) toast.success(data.expReward.message);
        } else {
          toast.error(data.error || "Không thể tạo bình luận");
        }
      } catch {
        toast.error("Có lỗi xảy ra khi tạo bình luận");
      } finally {
        setLoadingStates((prev) => ({ ...prev, creating: false }));
      }
    },
    [commentContent, composerGifs, isLoggedIn, mangaId, postId, activeComposer, loadComments],
  );

  /* -------- Delete -------- */
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

        const response = await fetch("/api/comments", { method: "DELETE", body: formData });
        const data = await response.json();

        if (data.success) {
          setComments((prev) =>
            prev
              .map((comment) => {
                if (comment.id === commentId) return null;
                if (comment.replies) {
                  const updated = comment.replies.filter((r) => r.id !== commentId);
                  return { ...comment, replies: updated };
                }
                return comment;
              })
              .filter(Boolean) as CommentTypeWithUser[],
          );
          toast.success(data.message); // GIỮ nguyên theo yêu cầu
        } else {
          toast.error(data.error || "Không thể xóa bình luận");
        }
      } catch {
        toast.error("Có lỗi xảy ra khi xóa bình luận");
      } finally {
        setLoadingStates((prev) => ({ ...prev, deleting: null }));
      }
    },
    [isAdmin],
  );

  /* -------- Like -------- */
  const handleLikeComment = useCallback(
    async (commentId: string) => {
      if (!isLoggedIn) return;
      setLoadingStates((prev) => ({ ...prev, liking: commentId }));

      try {
        const formData = new FormData();
        formData.append("commentId", commentId);
        formData.append("intent", "like-comment");

        const response = await fetch("/api/comments", { method: "POST", body: formData });
        const data = await response.json();

        if (data.success) {
          setComments((prev) =>
            prev.map((c) => {
              if (c.id === commentId) return { ...c, likeNumber: data.newLikeCount };
              if (c.replies) {
                const replies = c.replies.map((r) =>
                  r.id === commentId ? { ...r, likeNumber: data.newLikeCount } : r,
                );
                return { ...c, replies };
              }
              return c;
            }),
          );
          // Tắt toast thành công (giữ lỗi)
          // toast.success(data.message);
        } else {
          setComments((prev) =>
            prev.map((c) => {
              if (c.id === commentId) return { ...c, likeNumber: Math.max(0, (c.likeNumber || 0) - 1) };
              if (c.replies) {
                const replies = c.replies.map((r) =>
                  r.id === commentId ? { ...r, likeNumber: Math.max(0, (r.likeNumber || 0) - 1) } : r,
                );
                return { ...c, replies };
              }
              return c;
            }),
          );
          toast.error(data.error || "Không thể thích bình luận");
        }
      } catch {
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) return { ...c, likeNumber: Math.max(0, (c.likeNumber || 0) - 1) };
            if (c.replies) {
              const replies = c.replies.map((r) =>
                r.id === commentId ? { ...r, likeNumber: Math.max(0, (r.likeNumber || 0) - 1) } : r,
              );
              return { ...c, replies };
            }
            return c;
          }),
        );
        toast.error("Có lỗi xảy ra khi thích bình luận");
      } finally {
        setLoadingStates((prev) => ({ ...prev, liking: null }));
      }
    },
    [isLoggedIn],
  );

  /* -------- Report -------- */
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
        if (mangaId) formData.append("mangaId", mangaId);
        if (postId) formData.append("postId", postId);

        const response = await fetch("/api/reports", { method: "POST", body: formData });
        const data = await response.json();

        if (data.success) {
          setReportDialog({ isOpen: false, comment: null });
          toast.success("Báo cáo đã được gửi thành công"); // GIỮ nguyên theo yêu cầu
        } else {
          toast.error(data.error || "Không thể gửi báo cáo");
        }
      } catch {
        toast.error("Có lỗi xảy ra khi gửi báo cáo");
      } finally {
        setLoadingStates((prev) => ({ ...prev, reporting: false }));
      }
    },
    [reportDialog.comment, mangaId, postId],
  );

  /* -------- Other handlers -------- */
  const handleReply = useCallback((target: CommentTypeWithUser) => {
    const parentId = target.parentId || target.id; // thread gốc
    // Nếu trả lời một REPLY (có parentId) -> prefill tên; trả lời chủ comment -> không prefill
    const prefillName = target.parentId && target.userId?.name ? target.userId.name : undefined;
    setActiveComposer({
      parentId,
      anchorId: target.id,
      replyingTo: target.userId,
      prefillName,
    });
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
        setActiveComposer(null);
        loadComments(page);
      }
    },
    [pagination.totalPages, pagination.currentPage, loadComments],
  );

  /* -------- Replies load & toggle -------- */
  const loadReplies = useCallback(async (commentId: string) => {
    setLoadingStates((prev) => ({ ...prev, loadingReplies: commentId }));
    try {
      const params = new URLSearchParams({ parentId: commentId });
      const response = await fetch(`/api/comments?${params}`);
      const data = await response.json();
      if (data.success) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, replies: data.data || [] } : c)),
        );
        setReplyVisibility((prev) => ({ ...prev, [commentId]: true }));
      } else {
        toast.error(data.error || "Không thể tải phản hồi");
      }
    } catch {
      toast.error("Có lỗi xảy ra khi tải phản hồi");
    } finally {
      setLoadingStates((prev) => ({ ...prev, loadingReplies: null }));
    }
  }, []);

  const toggleReplies = useCallback(
    (commentId: string) => {
      const comment = comments.find((c) => c.id === commentId);
      if (!comment) return;
      const isVisible = replyVisibility[commentId];
      if (isVisible) {
        setReplyVisibility((prev) => ({ ...prev, [commentId]: false }));
      } else {
        if (!comment.replies) {
          loadReplies(commentId);
        } else {
          setReplyVisibility((prev) => ({ ...prev, [commentId]: true }));
        }
      }
    },
    [comments, replyVisibility, loadReplies],
  );

  /* -------- GIF helpers -------- */
  const GIF_REGEX = useMemo(() => /https?:\/\/[^ \n]*\/gif-meme\/[^\s)]+\.(?:gif|webp|jpe?g|png)/gi, []);

  const stripGifLinks = useCallback(
    (text: string) => text.replace(GIF_REGEX, "").replace(/\n{3,}/g, "\n\n").trim(),
    [GIF_REGEX],
  );

  const extractGifLinks = useCallback(
    (text: string) => (text.match(GIF_REGEX) ?? []).slice(0, 1),
    [GIF_REGEX],
  );

  /* -------- Reply item -------- */
  const ReplyComment = ({ reply }: { reply: CommentTypeWithUser }) => (
    <div className="flex items-start justify-start gap-4 self-stretch">
      {/* Avatar */}
      {reply.userId?.avatar ? (
        <Link to={getProfilePath(reply.userId)} aria-label={`Xem trang của ${reply.userId?.name}`}>
          <img
            className="mt-1.5 h-8 w-8 flex-shrink-0 rounded-full"
            src={reply.userId?.avatar}
            alt={`${reply.userId?.name} avatar`}
          />
        </Link>
      ) : (
        <Link to={getProfilePath(reply.userId)} aria-label={`Xem trang của ${reply.userId?.name}`}>
          <UserIcon className="mt-1.5 h-8 w-8 flex-shrink-0" />
        </Link>
      )}

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-2">
        <div className="bg-bgc-layer2 border-bd-default flex flex-col items-start justify-start self-stretch rounded-lg border overflow-hidden">
          {/* Header */}
          <div className="flex flex-col items-start justify-start gap-1.5 self-stretch px-3 py-1.5">
            <div className="flex items-center justify-between self-stretch">
                          <div className="flex items-center justify-start" style={{ gap: '1px' }}>
                <Link
                  to={getProfilePath(reply.userId)}
                              className="text-txt-primary font-sans text-[1.0rem] leading-tight font-medium hover:underline focus:underline flex items-center"
                  title={`Xem trang của ${reply.userId?.name}`}
                >
                  {reply.userId?.name}
                  {isDichGia(reply.userId?.role || "") && (
                    <span className="ml-1 animate-[shine_3s_linear_infinite] bg-gradient-to-r from-[#C466FF] via-[#924DBF] to-[#C466FF] bg-clip-text text-transparent font-semibold">– Dịch giả</span>
                  )}
                </Link>
                <img
                  className="h-8 transition-transform duration-200 will-change-transform md:hover:scale-150 md:hover:z-10 relative"
                  style={{ top: '-2px' }}
                  src={getTitleImgPath(reply.userId)}
                  alt="User badge"
                />
                <div
                  className="relative cursor-pointer select-none"
                  onMouseEnter={(e) => handleWaifuHover(e, (reply as any)?.userId?.waifuFilename)}
                  onMouseLeave={handleWaifuLeave}
                  onClick={(e) => handleWaifuClick(e, (reply as any)?.userId?.waifuFilename)}
                  role="button"
                  aria-label="Xem waifu"
                >
                  <WaifuMeta filename={(reply as any)?.userId?.waifuFilename ?? null} height={32} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleReportComment(reply)}
                  disabled={!isLoggedIn || loadingStates.reporting}
                  className="relative h-4 flex-shrink-0 cursor-pointer overflow-hidden transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  title={isLoggedIn ? "Báo cáo bình luận" : "Đăng nhập để báo cáo"}
                >
                  <Flag className="text-txt-secondary h-full" />
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteComment(reply.id)}
                    disabled={loadingStates.deleting === reply.id}
                    className="relative h-4 flex-shrink-0 overflow-hidden text-red-500 transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Xóa bình luận"
                  >
                    <Trash2 className="h-full" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex items-center justify-center gap-2.5 self-stretch bg-bgc-layer2 px-3 pb-3 pt-2">
            <div className="text-txt-primary flex-1 font-sans text-sm leading-tight font-medium">
              {renderReplyContent(stripGifLinks(reply.content))}
              {extractGifLinks(reply.content).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {extractGifLinks(reply.content).map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt="GIF"
                      className="max-h-24 rounded-md"
                      loading="lazy"
                      decoding="async"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions (reply: nhỏ hơn 3/4) */}
        <div className="flex flex-wrap items-center justify-start gap-4">
          <button
            onClick={() => handleLikeComment(reply.id)}
            disabled={!isLoggedIn || loadingStates.liking === reply.id}
            className="flex cursor-pointer items-center justify-start gap-1 text-txt-secondary transition-colors hover:text-txt-primary disabled:cursor-not-allowed disabled:opacity-50"
            title={isLoggedIn ? "Thích bình luận" : "Đăng nhập để thích"}
          >
            <ThumbsUp className="h-3 w-3" />
            <div className="font-sans text-[0.65rem] leading-[0.95rem] font-medium">
              {reply.likeNumber || 0}
            </div>
          </button>
          <button
            onClick={() => handleReply(reply)}
            disabled={!isLoggedIn}
            className="flex cursor-pointer items-center justify-start gap-1 text-txt-secondary transition-colors hover:text-txt-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageCircle className="h-3 w-3" />
            <div className="font-sans text-[0.65rem] leading-[0.95rem] font-medium">Trả lời</div>
          </button>
          <div className="text-txt-secondary font-sans text-[0.65rem] leading-[0.95rem] font-medium">
            {formatDistanceToNow(reply.createdAt)}
          </div>
        </div>

        {/* Inline composer dưới reply (nếu active) */}
        {activeComposer?.anchorId === reply.id && (
          <InlineComposerLine
            disabled={loadingStates.creating}
            onCancel={() => setActiveComposer(null)}
            onSubmit={(v) => handleSubmitComment(v)}
            initialMentionName={activeComposer?.prefillName || ""}
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="mt-8 flex flex-col items-start justify-start gap-6 self-stretch">
      {/* Header */}
      <div className="border-bd-default flex items-center justify-between self-stretch border-b pb-3">
        <div className="flex items-center justify-start gap-3">
          <MessageSquare className="h-6 w-6 text-lav-500" />
          <div className="text-txt-primary font-sans text-xl leading-7 font-semibold uppercase">
            bình luận
          </div>
        </div>

        {/* Reload */}
        <button
          onClick={() => loadComments(pagination.currentPage)}
          disabled={pagination.isLoading}
          className="text-txt-focus border-lav-500 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          title="Tải lại bình luận mới nhất"
        >
          <RotateCcw className={`h-4 w-4 ${pagination.isLoading ? "animate-spin" : ""}`} />
          {pagination.isLoading ? "Đang tải..." : "Tải lại"}
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col items-center justify-center gap-10 self-stretch">
        {/* Composer lớn: bình luận cấp 1 */}
        {isLoggedIn ? (
          <form onSubmit={handleSubmitComment} className="w-full">
            <div className="bg-bgc-layer2 border-bd-default flex flex-col items-start justify-start gap-3 self-stretch overflow-hidden rounded-xl border-b p-3">
              <textarea
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                placeholder="Mời đồng dâm vào chém gió về truyện..."
                className="text-txt-primary placeholder:text-txt-secondary min-h-[60px] w-full resize-none bg-transparent font-sans text-sm leading-tight font-medium outline-none"
                maxLength={1000}
              />
              {composerGifs.length > 0 && (
                <div className="-mt-1 flex w-full flex-wrap gap-2">
                  {composerGifs.map((url, idx) => (
                    <div key={`${url}-${idx}`} className="relative">
                      <img
                        src={url}
                        alt="GIF"
                        className="h-20 w-auto max-w-[150px] rounded-md border border-bd-default object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded-md bg-black/50 px-1.5 py-0.5 text-xs text-white hover:bg-black/70"
                        onClick={() => setComposerGifs((prev) => prev.filter((_, i) => i !== idx))}
                        title="Gỡ GIF"
                      >
                        Gỡ
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex w-full items-center justify-between">
                <div className="text-txt-secondary font-sans text-xs">
                  {commentContent.length}/1000 ký tự
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setGifDialogOpen(true)}
                    className="text-txt-secondary hover:text-txt-primary transition-colors px-1 py-1 rounded-md border border-transparent hover:border-bd-default flex items-center gap-[1px]"
                    title="Chèn GIF"
                  >
                    <ImageIcon className="h-5 w-5" />
                    <span className="text-xs leading-none font-medium">gif-meme</span>
                  </button>
                  <button
                    type="submit"
                    disabled={(!commentContent.trim() && composerGifs.length === 0) || loadingStates.creating}
                    className="bg-btn-primary text-txt-primary hover:bg-btn-primary/80 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {loadingStates.creating ? "Đang gửi..." : "Gửi"}
                  </button>
                </div>
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

        {/* Comments */}
        <div className="flex flex-col items-center justify-start gap-6 self-stretch">
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
              comments.map((comment: CommentTypeWithUser) => {
                const totalReplies = comment.replyCount ?? comment.replies?.length ?? 0;
                const showRepliesToggle = totalReplies > 0;
                const replyButtonCount = comment.replies?.length ?? totalReplies;

                return (
                  <div key={comment.id} className="flex items-start justify-start gap-4 self-stretch">
                    {/* Avatar */}
                    {comment.userId?.avatar ? (
                      <Link to={getProfilePath(comment.userId)} aria-label={`Xem trang của ${comment.userId?.name}`}>
                        <img
                          className="mt-1.5 h-10 w-10 flex-shrink-0 rounded-full"
                          src={comment.userId?.avatar}
                          alt={`${comment.userId?.name} avatar`}
                        />
                      </Link>
                    ) : (
                      <Link to={getProfilePath(comment.userId)} aria-label={`Xem trang của ${comment.userId?.name}`}>
                        <UserIcon className="mt-1.5 h-10 w-10 flex-shrink-0" />
                      </Link>
                    )}

                    {/* Content */}
                    <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-2">
                      <div className="bg-bgc-layer2 border-bd-default flex flex-col items-start justify-start self-stretch rounded-lg border overflow-hidden">
                        {/* Header */}
                        <div className="flex flex-col items-start justify-start gap-1.5 self-stretch px-3 py-1.5">
                          <div className="flex items-center justify-between self-stretch">
                            <div className="flex items-center justify-start" style={{ gap: '1px' }}>
                              <Link
                                to={getProfilePath(comment.userId)}
                                className="text-txt-primary font-sans text-[1.0rem] leading-tight font-medium hover:underline focus:underline flex items-center"
                                title={`Xem trang của ${comment.userId?.name}`}
                              >
                                {comment.userId?.name}
                                {isDichGia(comment.userId?.role || "") && (
                                  <span className="ml-1 animate-[shine_3s_linear_infinite] bg-gradient-to-r from-[#C466FF] via-[#924DBF] to-[#C466FF] bg-clip-text text-transparent font-semibold">– Dịch giả</span>
                                )}
                              </Link>
                              <img
                                className="h-10 transition-transform duration-200 will-change-transform md:hover:scale-150 md:hover:z-10 relative"
                                style={{ top: '-2px' }}
                                src={getTitleImgPath(comment.userId)}
                                alt="User badge"
                              />
                              <div
                                className="relative cursor-pointer select-none"
                                onMouseEnter={(e) => handleWaifuHover(e, (comment as any)?.userId?.waifuFilename)}
                                onMouseLeave={handleWaifuLeave}
                                onClick={(e) => handleWaifuClick(e, (comment as any)?.userId?.waifuFilename)}
                                role="button"
                                aria-label="Xem waifu"
                              >
                                <WaifuMeta filename={(comment as any)?.userId?.waifuFilename ?? null} height={40} />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleReportComment(comment)}
                                disabled={!isLoggedIn || loadingStates.reporting}
                                className="relative h-4 flex-shrink-0 cursor-pointer overflow-hidden transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                title={isLoggedIn ? "Báo cáo bình luận" : "Đăng nhập để báo cáo"}
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

                        {/* Body */}
                        <div className="flex items-center justify-center gap-2.5 self-stretch bg-bgc-layer2 px-3 pb-3 pt-2">
                          <div className="text-txt-primary flex-1 font-sans text-sm leading-tight font-medium">
                            {stripGifLinks(comment.content)}
                            {extractGifLinks(comment.content).length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {extractGifLinks(comment.content).map((url, idx) => (
                                  <img
                                    key={idx}
                                    src={url}
                                    alt="GIF"
                                    className="max-h-32 rounded-md"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions (comment chính: thu nhỏ 3/5) */}
                      <div className="flex flex-wrap items-center justify-start gap-4">
                        <button
                          onClick={() => handleLikeComment(comment.id)}
                          disabled={!isLoggedIn || loadingStates.liking === comment.id}
                          className="flex cursor-pointer items-center justify-start gap-1 text-txt-secondary transition-colors hover:text-txt-primary disabled:cursor-not-allowed disabled:opacity-50"
                          title={isLoggedIn ? "Thích bình luận" : "Đăng nhập để thích"}
                        >
                          <ThumbsUp className="h-3 w-3" />
                          <div className="font-sans text-[0.65rem] leading-[0.95rem] font-medium">
                            {comment.likeNumber || 0}
                          </div>
                        </button>
                        <button
                          onClick={() => handleReply(comment)}
                          disabled={!isLoggedIn}
                          className="flex cursor-pointer items-center justify-start gap-1 text-txt-secondary transition-colors hover:text-txt-primary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <MessageCircle className="h-3 w-3" />
                          <div className="font-sans text-[0.65rem] leading-[0.95rem] font-medium">Trả lời</div>
                        </button>

                        {/* Toggle replies: GIỮ tím-400 */}
                        {showRepliesToggle && (
                          <button
                            onClick={() => toggleReplies(comment.id)}
                            disabled={loadingStates.loadingReplies === comment.id}
                            className="
                              text-purple-400 hover:text-purple-300
                              flex cursor-pointer items-center justify-start gap-1
                              transition-colors disabled:cursor-not-allowed disabled:opacity-50
                            "
                            title="Xem phản hồi"
                          >
                            <MessagesSquare className="h-3 w-3" />
                            <div className="font-sans text-[0.65rem] leading-[0.95rem] font-medium">
                              {loadingStates.loadingReplies === comment.id
                                ? "Đang tải..."
                                : replyVisibility[comment.id]
                                  ? "Ẩn phản hồi"
                                  : `Xem ${replyButtonCount} phản hồi`}
                            </div>
                          </button>
                        )}

                        <div className="text-txt-secondary font-sans text-[0.65rem] leading-[0.95rem] font-medium">
                          {formatDistanceToNow(comment.createdAt)}
                        </div>
                      </div>

                      {/* Inline composer NGAY DƯỚI COMMENT (nếu active) */}
                      {activeComposer?.anchorId === comment.id && (
                        <InlineComposerLine
                          disabled={loadingStates.creating}
                          onCancel={() => setActiveComposer(null)}
                          onSubmit={(v) => handleSubmitComment(v)}
                          initialMentionName={activeComposer?.prefillName || ""}
                        />
                      )}

                      {/* Replies */}
                      {replyVisibility[comment.id] && comment.replies && (
                        <div className="mt-4 flex flex-col gap-4 self-stretch">
                          {comment.replies.map((reply) => (
                            <ReplyComment key={reply.id} reply={reply} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
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

      {/* Report dialog + Preview modal */}
      <ReportDialog isOpen={reportDialog.isOpen} onClose={handleCloseReportDialog} onSubmit={handleSubmitReport} />
      <GifMemeDialog
        isOpen={gifDialogOpen}
        onClose={() => setGifDialogOpen(false)}
        onSelect={(url) => {
          // Chỉ cho phép 1 GIF mỗi bình luận: thay thế GIF hiện tại nếu chọn lại
          setComposerGifs([url]);
          setGifDialogOpen(false);
        }}
      />
      {previewUser && <PreviewModal user={previewUser} onClose={closePreview} />}
      {waifuPopover && (
        <div
          className="pointer-events-none fixed z-[2000] -translate-x-1/2 -translate-y-full animate-in fade-in zoom-in duration-150"
          style={{ left: waifuPopover.x, top: waifuPopover.y }}
        >
          <div
            className="rounded-lg border border-bd-default bg-bgc-layer2 shadow-xl p-1"
            style={{ width: 200 }}
          >
            <img
              src={`/images/waifu/${encodeURIComponent(waifuPopover.filename)}`}
              alt="Waifu"
              className="h-[300px] w-full object-cover rounded-md"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      )}
    </div>
  );
}
