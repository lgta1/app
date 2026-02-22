import type { LoaderFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";
import { ReadingRewardModel } from "~/database/models/reading-reward.model";
import { UserChapterReactionModel } from "~/database/models/user-chapter-reaction.model";

const MAX_REWARD_PER_DAY = 3;
const RATE_LIMIT_MS = 60_000;

const noStoreHeaders = {
  "Cache-Control": "private, no-store, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  "Surrogate-Control": "no-store",
  Vary: "Cookie",
};

const anonymousCacheHeaders = {
  "Cache-Control": "public, max-age=900, s-maxage=900, stale-while-revalidate=120",
  "CDN-Cache-Control": "public, s-maxage=900, stale-while-revalidate=120",
  "Cloudflare-CDN-Cache-Control": "public, s-maxage=900, stale-while-revalidate=120",
  "Surrogate-Control": "public, s-maxage=900, stale-while-revalidate=120",
};

function getTodayInVietnam(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const cookieHeader = request.headers.get("Cookie") || "";
    const hasSessionCookie = /(?:^|;\s*)__session=/.test(cookieHeader);
    if (!hasSessionCookie) {
      return Response.json(
        {
          success: true,
          isLoggedIn: false,
          userReaction: null,
          rewardEligibility: null,
        },
        { headers: anonymousCacheHeaders },
      );
    }

    const user = await getUserInfoFromSession(request);
    if (!user) {
      return Response.json(
        {
          success: true,
          isLoggedIn: false,
          userReaction: null,
          rewardEligibility: null,
        },
        { headers: anonymousCacheHeaders },
      );
    }

    const userId = String((user as any)?.id ?? (user as any)?._id ?? "").trim();
    const chapterId = new URL(request.url).searchParams.get("chapterId")?.trim() ?? "";

    let userReaction: "like" | "dislike" | null = null;
    if (chapterId) {
      const reactionDoc = await UserChapterReactionModel.findOne({ userId, chapterId })
        .select({ reaction: 1 })
        .lean();
      const reaction = String((reactionDoc as any)?.reaction ?? "").trim();
      userReaction = reaction === "like" || reaction === "dislike" ? reaction : null;
    }

    const now = new Date();
    const today = getTodayInVietnam(now);
    const rewardDoc = await ReadingRewardModel.findOne({ userId, date: today })
      .select({ rewardCount: 1, updatedAt: 1 })
      .lean();

    const rewardCount = Math.max(0, Number((rewardDoc as any)?.rewardCount) || 0);
    const remaining = Math.max(0, MAX_REWARD_PER_DAY - rewardCount);
    const updatedAt = rewardDoc && (rewardDoc as any).updatedAt
      ? new Date((rewardDoc as any).updatedAt)
      : null;
    const nextEligibleAtMs = updatedAt ? updatedAt.getTime() + RATE_LIMIT_MS : 0;
    const hasMinuteCooldown = Boolean(nextEligibleAtMs && Date.now() < nextEligibleAtMs);
    const canClaim = remaining > 0 && !hasMinuteCooldown;

    return Response.json(
      {
        success: true,
        isLoggedIn: true,
        userReaction,
        rewardEligibility: {
          canClaim,
          remaining,
          nextEligibleAt: hasMinuteCooldown ? new Date(nextEligibleAtMs).toISOString() : undefined,
        },
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    console.error("api.chapter.user-state loader error:", error);
    return Response.json(
      {
        success: false,
        error: "Không thể lấy trạng thái người dùng cho chương",
      },
      {
        status: 500,
        headers: noStoreHeaders,
      },
    );
  }
}
