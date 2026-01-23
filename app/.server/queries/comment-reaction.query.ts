import { isValidObjectId } from "mongoose";

import type { ReactionType } from "~/constants/reactions";
import { UserReactionCommentModel } from "~/database/models/user-reaction-comment.model";

export const getUserReactionsForComments = async (
  userId: string,
  commentIds: string[],
): Promise<Record<string, ReactionType>> => {
  if (!isValidObjectId(userId)) return {};

  const ids = (commentIds || []).filter(Boolean);
  if (ids.length === 0) return {};

  const docs = await UserReactionCommentModel.find({ userId, commentId: { $in: ids } })
    .select("commentId reaction")
    .lean();

  const map: Record<string, ReactionType> = Object.create(null);
  for (const d of docs as any[]) {
    if (d?.commentId && d?.reaction) map[String(d.commentId)] = d.reaction as ReactionType;
  }
  return map;
};
