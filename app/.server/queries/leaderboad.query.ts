import { generateLeaderboardPipeline, type LeaderboardPeriod } from "@/services/leaderboard.svc";
import { InteractionModel } from "~/database/models/interaction.model";
import { MangaModel, type MangaType } from "~/database/models/manga.model";
import { ENV } from "@/configs/env.config";

import { MANGA_CONTENT_TYPE, MANGA_STATUS } from "~/constants/manga";
import { getLatestChapterTitlesForMangaIds } from "./shared.latest-chapter-titles";
import { ensureSlugForDocs } from "~/database/helpers/manga-slug.helper";

const HOT_CAROUSEL_LIMITS = {
  MANGA: ENV.LEADERBOARD.MAX_ITEMS,
  COSPLAY: 2,
} as const;
const HOT_CAROUSEL_TOTAL = HOT_CAROUSEL_LIMITS.MANGA + HOT_CAROUSEL_LIMITS.COSPLAY;
const HOT_CAROUSEL_PIPELINE_LIMIT = Math.max(HOT_CAROUSEL_TOTAL + 40, 120);
const HOT_CAROUSEL_CACHE_TTL_MS = 60 * 1000; // cache snapshot for 60s to avoid re-aggregating per request

type HotCarouselCache = {
  data: MangaType[];
  expiresAt: number;
};

let hotCarouselCache: HotCarouselCache | null = null;

const attachLatestChapterTitles = async (items: any[]) => {
  const ids = items.map((s: any) => String(s.id ?? s._id ?? "")).filter(Boolean);
  if (ids.length === 0) return;
  const titles = await getLatestChapterTitlesForMangaIds(ids).catch(() => ({} as Record<string, string>));
  for (const it of items as any[]) {
    const sid = String(it.id ?? it._id ?? "");
    if (sid && titles[sid]) (it as any).latestChapterTitle = titles[sid];
  }
};

const mapWithStableId = (docs: any[]) => docs.map((d: any) => ({ id: String(d?._id ?? d?.id ?? ""), ...d }));

const getDailyViewsLeaderboard = async () => {
  const docs = await MangaModel.find({
    status: 1 /* APPROVED */,
    contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
  })
    .sort({ dailyViews: -1, updatedAt: -1 })
    .limit(ENV.LEADERBOARD.MAX_ITEMS)
    .lean();

  await ensureSlugForDocs(docs as any[]);
  const out = mapWithStableId(docs);
  await attachLatestChapterTitles(out);
  for (const s of out as any[]) {
    (s as any).viewNumber = s.dailyViews || 0;
  }
  return out;
};

export const getLeaderboard = async (period: LeaderboardPeriod) => {
  if (period === "daily") {
    return getDailyViewsLeaderboard();
  }

  // Weekly/Monthly dùng lightweight counters trực tiếp trên MangaModel
  if (period === "weekly" || period === "monthly") {
    const sortKey = period === "weekly" ? "weeklyViews" : "monthlyViews";
    const docs = await MangaModel.find({
      status: 1 /* APPROVED */,
      contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
    })
      .sort({ [sortKey]: -1, updatedAt: -1 })
      .limit(ENV.LEADERBOARD.MAX_ITEMS)
      .lean();

    await ensureSlugForDocs(docs as any[]);
    const out = mapWithStableId(docs);
    await attachLatestChapterTitles(out);
    for (const s of out as any[]) {
      if (period === "weekly") (s as any).viewNumber = s.weeklyViews || 0;
      if (period === "monthly") (s as any).viewNumber = s.monthlyViews || 0;
    }
    return out;
  }

  return [];
};

export const getHotCarouselLeaderboard = async () => {
  const now = Date.now();
  if (hotCarouselCache && hotCarouselCache.expiresAt > now) {
    return hotCarouselCache.data;
  }

  const fresh = await aggregateHotCarouselSnapshot();
  hotCarouselCache = {
    data: fresh,
    expiresAt: now + HOT_CAROUSEL_CACHE_TTL_MS,
  };

  return fresh;
};

const aggregateHotCarouselSnapshot = async () => {
  const leaderboardDocs = await InteractionModel.aggregate(buildHotCarouselPipeline(HOT_CAROUSEL_PIPELINE_LIMIT) as any);
  if (!leaderboardDocs?.length) return [];

  // Diversity & freshness adjustments for HOT carousel ordering.
  // - Penalize items already dominating weekly/monthly leaderboards.
  // - Boost items that have a very recent chapter (approx via Manga.updatedAt).
  const now = Date.now();
  const recentThresholdMs = now - 12 * 3600 * 1000;
  const TOP_RANK_PENALTY = [0.25, 0.21, 0.18, 0.15, 0.12] as const;
  const [weeklyTopDocs, monthlyTopDocs] = await Promise.all([
    MangaModel.find({
      status: 1 /* APPROVED */,
      contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
    })
      .sort({ weeklyViews: -1, updatedAt: -1 })
      .limit(5)
      .select({ _id: 1 })
      .lean(),
    MangaModel.find({
      status: 1 /* APPROVED */,
      contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
    })
      .sort({ monthlyViews: -1, updatedAt: -1 })
      .limit(5)
      .select({ _id: 1 })
      .lean(),
  ]);

  const weeklyRankMap = new Map<string, number>();
  for (let i = 0; i < weeklyTopDocs.length; i++) {
    const id = String((weeklyTopDocs[i] as any)?._id ?? "");
    if (id) weeklyRankMap.set(id, i + 1);
  }
  const monthlyRankMap = new Map<string, number>();
  for (let i = 0; i < monthlyTopDocs.length; i++) {
    const id = String((monthlyTopDocs[i] as any)?._id ?? "");
    if (id) monthlyRankMap.set(id, i + 1);
  }

  const leaderboardIds = leaderboardDocs
    .map((doc: any) => String(doc?.story_id ?? doc?._id ?? ""))
    .filter(Boolean);
  if (!leaderboardIds.length) return [];

  const stories = await MangaModel.find({ _id: { $in: leaderboardIds } }).lean<MangaType>();
  const storyMap = new Map(stories.map((story) => [String((story as any)?._id ?? story?.id ?? ""), story]));

  const getAdjustedScore = (doc: any, story?: MangaType | null) => {
    const sid = String(doc?.story_id ?? doc?._id ?? "");
    const baseScore = typeof doc?.score === "number" ? doc.score : 0;

    // Rank-based penalties (additive):
    // - Weekly top 1..5: 25%, 21%, 18%, 15%, 12%
    // - Monthly top 1..5: 25%, 21%, 18%, 15%, 12%
    // If a manga is top #1 in both weekly & monthly, penalty becomes 50%.
    const weeklyRank = weeklyRankMap.get(sid);
    const monthlyRank = monthlyRankMap.get(sid);
    const weeklyPenalty = weeklyRank && weeklyRank <= 5 ? TOP_RANK_PENALTY[weeklyRank - 1] : 0;
    const monthlyPenalty = monthlyRank && monthlyRank <= 5 ? TOP_RANK_PENALTY[monthlyRank - 1] : 0;
    const penalty = weeklyPenalty + monthlyPenalty;

    // Recent bonus applies to manga only (contentType MANGA/null) and uses updatedAt as proxy for latest chapter time.
    const contentType = (story as any)?.contentType ?? MANGA_CONTENT_TYPE.MANGA;
    const storyUpdatedAt = (story as any)?.updatedAt instanceof Date
      ? (story as any).updatedAt
      : (story as any)?.updatedAt
        ? new Date((story as any).updatedAt)
        : null;
    const isRecent =
      (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) &&
      !!storyUpdatedAt &&
      !Number.isNaN(storyUpdatedAt.getTime()) &&
      storyUpdatedAt.getTime() >= recentThresholdMs;
    const bonusMultiplier = isRecent ? 1.25 : 1;

    return baseScore * (1 - penalty) * bonusMultiplier;
  };

  // Re-rank documents using adjusted score (tie-break by base score then most recent interaction).
  const rankedDocs = [...leaderboardDocs].sort((a: any, b: any) => {
    const aId = String(a?.story_id ?? a?._id ?? "");
    const bId = String(b?.story_id ?? b?._id ?? "");
    const aStory = storyMap.get(aId);
    const bStory = storyMap.get(bId);

    const aAdj = getAdjustedScore(a, aStory);
    const bAdj = getAdjustedScore(b, bStory);
    if (bAdj !== aAdj) return bAdj - aAdj;

    const aBase = typeof a?.score === "number" ? a.score : 0;
    const bBase = typeof b?.score === "number" ? b.score : 0;
    if (bBase !== aBase) return bBase - aBase;

    const aT = a?.last_interaction_at instanceof Date ? a.last_interaction_at.getTime() : (a?.last_interaction_at ? new Date(a.last_interaction_at).getTime() : 0);
    const bT = b?.last_interaction_at instanceof Date ? b.last_interaction_at.getTime() : (b?.last_interaction_at ? new Date(b.last_interaction_at).getTime() : 0);
    return bT - aT;
  });

  const mangaList: MangaType[] = [];
  const cosplayList: MangaType[] = [];
  const seen = new Set<string>();

  for (const doc of rankedDocs as any[]) {
    const sid = String(doc?.story_id ?? doc?._id ?? "");
    if (!sid || seen.has(sid)) continue;
    const story = storyMap.get(sid);
    if (!story) continue;
    if (story.status !== MANGA_STATUS.APPROVED) continue;

    const type = story.contentType ?? MANGA_CONTENT_TYPE.MANGA;
    if (type === MANGA_CONTENT_TYPE.COSPLAY) {
      if (cosplayList.length < HOT_CAROUSEL_LIMITS.COSPLAY) {
        cosplayList.push(story);
        seen.add(sid);
      }
    } else {
      if (mangaList.length < HOT_CAROUSEL_LIMITS.MANGA) {
        mangaList.push(story);
        seen.add(sid);
      }
    }

    if (
      mangaList.length >= HOT_CAROUSEL_LIMITS.MANGA &&
      cosplayList.length >= HOT_CAROUSEL_LIMITS.COSPLAY
    ) {
      break;
    }
  }

  const FIRST_COSPLAY_INSERT_INDEX = 5;
  const combined: MangaType[] = [];
  combined.push(...mangaList.slice(0, FIRST_COSPLAY_INSERT_INDEX));
  if (cosplayList.length > 0) {
    combined.push(cosplayList[0]);
  }
  combined.push(...mangaList.slice(FIRST_COSPLAY_INSERT_INDEX));
  if (cosplayList.length > 1) {
    combined.push(cosplayList[1]);
  }
  if (cosplayList.length > 2) {
    combined.push(...cosplayList.slice(2));
  }

  await ensureSlugForDocs(combined as any[]);
  await attachLatestChapterTitles(combined);
  for (const story of combined as MangaType[]) {
    if (!story.id) {
      story.id = String((story as any)?._id ?? "");
    }
  }

  return combined;
};

const buildHotCarouselPipeline = (limit: number) => {
  const base = generateLeaderboardPipeline("daily");
  const pipeline: Record<string, any>[] = [];

  for (const stage of base as Record<string, any>[]) {
    if (stage.$merge) continue; // skip snapshot merge stage for request-time aggregation
    if (stage.$limit != null) {
      pipeline.push({ $limit: limit });
      continue;
    }
    pipeline.push(stage);
  }

  // In case pipeline generator changes and no $limit stage is returned, enforce limit near the end.
  if (!pipeline.some((stage) => stage.$limit != null)) {
    pipeline.push({ $limit: limit });
  }

  return pipeline;
};
