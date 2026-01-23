import { useEffect, useMemo, useRef, useState } from "react";

import type { ReactionCounts, ReactionType } from "~/constants/reactions";
import { getTopReactions, normalizeReactionCounts, REACTION_META, REACTION_TYPES } from "~/constants/reactions";

type Props = {
  isLoggedIn: boolean;
  disabled?: boolean;
  compact?: boolean;

  commentId: string;
  userReaction: ReactionType | null | undefined;
  reactionCounts: Partial<ReactionCounts> | null | undefined;
  totalReactions: number | null | undefined;

  loading?: boolean;
  onReact: (commentId: string, reaction: ReactionType) => void | Promise<void>;
};

export function CommentReaction({
  isLoggedIn,
  disabled,
  compact,
  commentId,
  userReaction,
  reactionCounts,
  totalReactions,
  loading,
  onReact,
}: Props) {
  const [open, setOpen] = useState(false);
  const holdTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const counts = useMemo(() => normalizeReactionCounts(reactionCounts), [reactionCounts]);
  const total = useMemo(() => {
    const n = Number(totalReactions);
    return Number.isFinite(n) ? n : 0;
  }, [totalReactions]);

  const top = useMemo(() => getTopReactions(counts, 3), [counts]);

  const buttonLabel = "Cảm xúc";

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearHoldTimer();
      clearCloseTimer();
    };
  }, []);

  const requestToggleOrLike = async () => {
    if (!isLoggedIn || disabled || loading) return;

    // Quick click behavior:
    // - no reaction: set Like
    // - already reacted: toggle off by sending the same reaction
    const next: ReactionType = userReaction ?? "like";
    await onReact(commentId, next);
  };

  const openBar = () => {
    if (!isLoggedIn || disabled) return;
    clearCloseTimer();
    setOpen(true);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 180);
  };

  return (
    <div className="relative inline-flex items-center gap-2">
      <div
        className="relative"
        onMouseEnter={openBar}
        onMouseLeave={scheduleClose}
        onPointerDown={(e) => {
          if (!isLoggedIn || disabled) return;
          if ((e as any).pointerType === "touch") {
            clearHoldTimer();
            holdTimerRef.current = window.setTimeout(() => setOpen(true), 420);
          }
        }}
        onPointerUp={clearHoldTimer}
        onPointerCancel={clearHoldTimer}
      >
        {/* Reaction bar */}
        <div
          className={
            "absolute -top-12 left-0 z-20 origin-bottom-left rounded-full border border-bd-default bg-bgc-layer2 px-2 py-1 shadow-lg backdrop-blur transition-all duration-150 " +
            (open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0")
          }
          role="menu"
          aria-label="Chọn cảm xúc"
        >
          <div className="flex items-center gap-1">
            {REACTION_TYPES.map((t) => {
              const meta = REACTION_META[t];
              const isActive = userReaction === t;
              return (
                <button
                  key={t}
                  type="button"
                  className={
                    "flex h-8 w-8 items-center justify-center rounded-full text-lg transition-transform duration-150 hover:scale-125 focus:scale-125 focus:outline-none " +
                    (isActive ? "bg-white/10" : "")
                  }
                  title={meta.label}
                  onClick={async () => {
                    if (!isLoggedIn || disabled || loading) return;
                    await onReact(commentId, t);
                    setOpen(false);
                  }}
                >
                  <span aria-hidden="true">{meta.emoji}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main button */}
        <button
          type="button"
          onClick={requestToggleOrLike}
          disabled={!isLoggedIn || disabled || !!loading}
          className={
            "flex items-center gap-1 text-txt-secondary transition-colors hover:text-txt-primary disabled:cursor-not-allowed disabled:opacity-50 " +
            (compact ? "text-[0.65rem]" : "text-xs")
          }
          title={isLoggedIn ? "Thả cảm xúc" : "Đăng nhập để thả cảm xúc"}
        >
          <span className={compact ? "leading-[0.95rem]" : "leading-4"}>{buttonLabel}</span>
        </button>
      </div>
    </div>
  );
}

export function CommentReactionSummary({
  reactionCounts,
  totalReactions,
  compact,
  className,
}: {
  reactionCounts: Partial<ReactionCounts> | null | undefined;
  totalReactions: number | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  const counts = useMemo(() => normalizeReactionCounts(reactionCounts), [reactionCounts]);
  const total = useMemo(() => {
    const n = Number(totalReactions);
    return Number.isFinite(n) ? n : 0;
  }, [totalReactions]);
  const top = useMemo(() => getTopReactions(counts, 3), [counts]);

  if (total <= 0) return null;

  return (
    <div className={"flex items-center gap-1 text-txt-secondary " + (className ?? "")}>
      <div className="flex -space-x-1">
        {top.map((t) => (
          <span
            key={t}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-bgc-layer2 text-[0.75rem]"
            title={REACTION_META[t].label}
          >
            {REACTION_META[t].emoji}
          </span>
        ))}
      </div>
      <span className={compact ? "font-sans text-[0.65rem] leading-[0.95rem] font-medium" : "text-xs"}>{total}</span>
    </div>
  );
}
