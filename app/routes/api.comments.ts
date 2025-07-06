import { createComment, deleteComment, likeComment } from "@/mutations/comment.mutation";
import { getComments, getReplies } from "@/queries/comment.query";
import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/api.comments";

import { CommentExpModel } from "~/database/models/comment-exp.model";
import { UserModel } from "~/database/models/user.model";
import { isBusinessError, returnBusinessError } from "~/helpers/errors.helper";

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const url = new URL(request.url);
    const mangaId = url.searchParams.get("mangaId");
    const postId = url.searchParams.get("postId");
    const parentId = url.searchParams.get("parentId");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "5");

    if (parentId) {
      const replies = await getReplies(parentId);
      return Response.json({
        data: replies,
        success: true,
      });
    }

    if (!mangaId && !postId) {
      return Response.json(
        { error: "mangaId hoặc postId là bắt buộc", success: false },
        { status: 400 },
      );
    }

    if (mangaId && postId) {
      return Response.json(
        { error: "Không thể có cả mangaId và postId", success: false },
        { status: 400 },
      );
    }

    const commentsData = await getComments(
      { mangaId: mangaId || undefined, postId: postId || undefined },
      page,
      limit,
    );

    return Response.json({
      data: commentsData.data,
      totalPages: commentsData.totalPages,
      currentPage: commentsData.currentPage,
      totalCount: commentsData.totalCount,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return Response.json(
      { error: "Có lỗi xảy ra khi tải bình luận", success: false },
      { status: 500 },
    );
  }
}

// Helper function để claim exp từ comment
async function claimCommentExp(userId: string) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);

    // Check if user can claim exp (rate limiting + daily limit)
    const currentExp = await CommentExpModel.findOne({
      userId,
      date: today,
      $and: [
        { totalExp: { $lt: 50 } },
        {
          $or: [{ updatedAt: { $lt: oneMinuteAgo } }, { updatedAt: { $exists: false } }],
        },
      ],
    });

    // If no valid record found, check if it's due to rate limit or daily limit
    if (!currentExp) {
      const existingRecord = await CommentExpModel.findOne({ userId, date: today });
      if (existingRecord) {
        if (existingRecord.totalExp >= 50) {
          return { success: false, reason: "daily_limit" };
        } else {
          return { success: false, reason: "rate_limit" };
        }
      }
    }

    const currentCommentsPosted = currentExp?.commentsPosted || 0;
    const currentTotalExp = currentExp?.totalExp || 0;

    if (currentTotalExp >= 50) {
      return { success: false, reason: "daily_limit" };
    }

    // Calculate exp to gain
    let expToGain = currentCommentsPosted < 5 ? 5 : 1;
    const maxPossibleExp = 50 - currentTotalExp;
    expToGain = Math.min(expToGain, maxPossibleExp);

    if (expToGain <= 0) {
      return { success: false, reason: "daily_limit" };
    }

    // Atomic update
    const updatedExp = await CommentExpModel.findOneAndUpdate(
      { userId, date: today },
      {
        $inc: {
          commentsPosted: 1,
          totalExp: expToGain,
        },
      },
      { upsert: true, new: true },
    );

    // Update user exp
    await UserModel.findByIdAndUpdate(userId, {
      $inc: { exp: expToGain },
    });

    const isFirstFiveComments = updatedExp.commentsPosted <= 5;

    return {
      success: true,
      expGained: expToGain,
      totalExp: updatedExp.totalExp,
      commentsPosted: updatedExp.commentsPosted,
      remainingExp: Math.max(0, 50 - updatedExp.totalExp),
      isFirstFiveComments,
      message: `Bạn nhận được ${expToGain} exp từ bình luận! (${isFirstFiveComments ? "5 comment đầu" : "comment thường"})`,
    };
  } catch (error) {
    console.error("Error claiming comment exp:", error);
    return { success: false, reason: "error" };
  }
}

export async function action({ request }: Route.ActionArgs) {
  try {
    const user = await getUserInfoFromSession(request);

    if (!user) {
      return Response.json({ error: "Vui lòng đăng nhập để bình luận" }, { status: 401 });
    }

    if (request.method === "DELETE") {
      const formData = await request.formData();
      const commentId = formData.get("commentId") as string;
      const intent = formData.get("intent") as string;

      if (intent !== "delete-comment") {
        return Response.json({ error: "Intent không hợp lệ" }, { status: 400 });
      }

      if (!commentId) {
        return Response.json({ error: "commentId là bắt buộc" }, { status: 400 });
      }

      await deleteComment(commentId, request);

      return Response.json({
        success: true,
        commentId,
        message: "Xóa bình luận thành công",
      });
    }

    // Xử lý POST request
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "create-comment") {
      const content = formData.get("content") as string;
      const mangaId = formData.get("mangaId") as string;
      const postId = formData.get("postId") as string;
      const parentId = formData.get("parentId") as string;

      if (!content) {
        return Response.json(
          { error: "Nội dung bình luận là bắt buộc" },
          { status: 400 },
        );
      }

      // Nếu không có parentId, cần có mangaId hoặc postId
      if (!parentId && !mangaId && !postId) {
        return Response.json(
          { error: "mangaId, postId hoặc parentId là bắt buộc" },
          { status: 400 },
        );
      }

      if (mangaId && postId) {
        return Response.json(
          { error: "Không thể có cả mangaId và postId" },
          { status: 400 },
        );
      }

      // Create comment
      const comment = await createComment({
        content,
        mangaId: mangaId || undefined,
        postId: postId || undefined,
        parentId: parentId || undefined,
        userId: user.id,
      });

      // Try to claim exp from comment (non-blocking)
      const expResult = await claimCommentExp(user.id);

      // Return response with both comment and exp info
      return Response.json({
        success: true,
        comment,
        expReward: expResult.success
          ? {
              expGained: expResult.expGained,
              message: expResult.message,
              totalExp: expResult.totalExp,
              remainingExp: expResult.remainingExp,
            }
          : null,
      });
    }

    if (intent === "like-comment") {
      const commentId = formData.get("commentId") as string;

      if (!commentId) {
        return Response.json({ error: "commentId là bắt buộc" }, { status: 400 });
      }

      const result = await likeComment(commentId, user.id);

      return Response.json(result);
    }

    return Response.json({ error: "Intent không hợp lệ" }, { status: 400 });
  } catch (error) {
    if (isBusinessError(error)) {
      return returnBusinessError(error);
    }

    console.error("Error in comment action:", error);
    return Response.json({ error: "Có lỗi xảy ra" }, { status: 500 });
  }
}
