import { ChapterModel } from "~/database/models/chapter.model";
import { MangaModel } from "~/database/models/manga.model";
import { UserChapterReactionModel } from "~/database/models/user-chapter-reaction.model";
import {
  calcChapterScore,
  calcChapterWeight,
  calcStoryScoreFromAggregates,
  type ChapterReaction,
} from "~/constants/chapter-rating";
import { BusinessError } from "~/helpers/errors.helper";

export async function reactToChapter(options: {
  userId: string;
  chapterId: string;
  reaction: ChapterReaction;
}) {
  const userId = String(options.userId || "").trim();
  const chapterId = String(options.chapterId || "").trim();
  const reaction = options.reaction;

  if (!userId) throw new BusinessError("Vui lòng đăng nhập để đánh giá chương");
  if (!chapterId) throw new BusinessError("chapterId là bắt buộc");
  if (reaction !== "like" && reaction !== "dislike") throw new BusinessError("reaction không hợp lệ");

  const chapter = await ChapterModel.findById(chapterId)
    .select({ mangaId: 1, likeNumber: 1, dislikeNumber: 1, chapScore: 1 })
    .lean();

  if (!chapter) throw new BusinessError("Không tìm thấy chương");
  const mangaId = String((chapter as any).mangaId || "").trim();
  if (!mangaId) throw new BusinessError("Thiếu mangaId của chương");

  const oldLike = Math.max(0, Number((chapter as any).likeNumber) || 0);
  const oldDislike = Math.max(0, Number((chapter as any).dislikeNumber) || 0);
  const oldVotes = oldLike + oldDislike;
  const oldWeight = calcChapterWeight(oldVotes);
  const oldChapScore = Number((chapter as any).chapScore) || calcChapterScore(oldLike, oldDislike);

  const existing = await UserChapterReactionModel.findOne({ userId, chapterId })
    .select({ reaction: 1 })
    .lean();

  // No-op if user repeats the same reaction
  if (existing && (existing as any).reaction === reaction) {
    const like = oldLike;
    const dislike = oldDislike;
    const votes = oldVotes;
    const chapScore = oldChapScore;
    return { like, dislike, votes, chapScore, userReaction: reaction };
  }

  let newLike = oldLike;
  let newDislike = oldDislike;

  if (!existing) {
    // First-time vote
    await UserChapterReactionModel.create({ userId, chapterId, reaction });
    if (reaction === "like") newLike += 1;
    else newDislike += 1;
  } else {
    // Switch reaction
    const prev = (existing as any).reaction as ChapterReaction;
    await UserChapterReactionModel.updateOne({ userId, chapterId }, { $set: { reaction } });

    if (prev === "like") newLike = Math.max(0, newLike - 1);
    if (prev === "dislike") newDislike = Math.max(0, newDislike - 1);

    if (reaction === "like") newLike += 1;
    else newDislike += 1;
  }

  const newVotes = newLike + newDislike;
  const newChapScore = calcChapterScore(newLike, newDislike);

  // Persist chapter counters + cached score
  await ChapterModel.findByIdAndUpdate(
    chapterId,
    { $set: { likeNumber: newLike, dislikeNumber: newDislike, chapScore: newChapScore } },
    { timestamps: false },
  );

  // Update manga aggregates (O(1))
  const newWeight = calcChapterWeight(newVotes);
  const deltaSumWeight = newWeight - oldWeight;
  const deltaSumWeightedScore = newChapScore * newWeight - oldChapScore * oldWeight;
  const deltaTotalVotes = newVotes - oldVotes;
  const deltaChaptersWithVotes = oldVotes === 0 && newVotes > 0 ? 1 : oldVotes > 0 && newVotes === 0 ? -1 : 0;

  const manga = await MangaModel.findById(mangaId)
    .select({
      ratingSumWeightedScore: 1,
      ratingSumWeight: 1,
      ratingTotalVotes: 1,
      ratingChaptersWithVotes: 1,
    })
    .lean();

  if (manga) {
    const nextSumWeight = (Number((manga as any).ratingSumWeight) || 0) + deltaSumWeight;
    const nextSumWeightedScore = (Number((manga as any).ratingSumWeightedScore) || 0) + deltaSumWeightedScore;
    const nextTotalVotes = (Number((manga as any).ratingTotalVotes) || 0) + deltaTotalVotes;
    const nextChaptersWithVotes = (Number((manga as any).ratingChaptersWithVotes) || 0) + deltaChaptersWithVotes;

    const nextScore = calcStoryScoreFromAggregates(nextSumWeightedScore, nextSumWeight);

    await MangaModel.findByIdAndUpdate(
      mangaId,
      {
        $set: {
          ratingSumWeight: nextSumWeight,
          ratingSumWeightedScore: nextSumWeightedScore,
          ratingTotalVotes: nextTotalVotes,
          ratingChaptersWithVotes: nextChaptersWithVotes,
          ratingScore: nextScore,
          ratingUpdatedAt: new Date(),
        },
      },
      { timestamps: false },
    );
  }

  return { like: newLike, dislike: newDislike, votes: newVotes, chapScore: newChapScore, userReaction: reaction };
}
