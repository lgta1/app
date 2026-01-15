import { generateLeaderboardPipeline, type LeaderboardPeriod } from "@/services/leaderboard.svc";
import { InteractionModel } from "~/database/models/interaction.model";
import { MangaModel, type MangaType } from "~/database/models/manga.model";
import { ENV } from "@/configs/env.config";

import { MANGA_CONTENT_TYPE, MANGA_STATUS } from "~/constants/manga";
import { getLatestChapterTitlesForMangaIds } from "./shared.latest-chapter-titles";
import { ensureSlugForDocs } from "~/database/helpers/manga-slug.helper";
import { rewriteLegacyCdnUrl } from "~/.server/utils/cdn-url";
import { toSlug } from "~/utils/slug.utils";

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

export type HotCarouselScoreBreakdown = {
  baseScore: number;
  baseScoreViewsWeighted: number;
  baseScoreViewsContribution: number;
  baseScoreCommentsContribution: number;
  baseScoreOldViewsContribution: number;
  weeklyRank: number | null;
  monthlyRank: number | null;
  weeklyPenalty: number;
  monthlyPenalty: number;
  penalty: number;
  penaltyMultiplier: number;
  isRecent: boolean;
  recentMultiplier: number;
  hasManhwaGenre: boolean;
  genreMultiplier: number;
  hasDisturbingTags: boolean;
  disturbingMultiplier: number;
  adjustedScore: number;
};

export type HotCarouselScoreRow = {
  rank: number;
  id: string;
  story: MangaType;
  baseScore: number;
  adjustedScore: number;
  breakdown: HotCarouselScoreBreakdown;
  steps: string[];
  formula: string;
  lastInteractionAt: string | null;
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

const normalizeMangaAssets = (story: any) => {
  if (!story || typeof story !== "object") return story;
  if (typeof (story as any).poster === "string") (story as any).poster = rewriteLegacyCdnUrl((story as any).poster);
  if (typeof (story as any).shareImage === "string") (story as any).shareImage = rewriteLegacyCdnUrl((story as any).shareImage);
  return story;
};

const getDailyViewsLeaderboard = async () => {
  const docs = await MangaModel.find({
    status: 1 /* APPROVED */,
    contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
  })
    .sort({ dailyViews: -1, updatedAt: -1 })
    .limit(ENV.LEADERBOARD.MAX_ITEMS)
    .lean();

  await ensureSlugForDocs(docs as any[]);
  const out = mapWithStableId(docs).map(normalizeMangaAssets);
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
    const out = mapWithStableId(docs).map(normalizeMangaAssets);
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

  const stories = (await MangaModel.find({ _id: { $in: leaderboardIds } }).lean()) as any as MangaType[];
  const storyMap = new Map<string, MangaType>(
    (Array.isArray(stories) ? stories : []).map((story: MangaType) => [
      String((story as any)?._id ?? (story as any)?.id ?? ""),
      story,
    ]),
  );

  const getHotCarouselScoreBreakdown = (doc: any, story?: MangaType | null): HotCarouselScoreBreakdown => {
    const sid = String(doc?.story_id ?? doc?._id ?? "");
    const baseScore = typeof doc?.score === "number" ? doc.score : 0;

    // Base score breakdown (daily rolling pipeline buckets)
    const views0_2h = Math.max(0, Number(doc?.views_0_2h) || 0);
    const views2_4h = Math.max(0, Number(doc?.views_2_4h) || 0);
    const views4_6h = Math.max(0, Number(doc?.views_4_6h) || 0);
    const views6_12h = Math.max(0, Number(doc?.views_6_12h) || 0);
    const commentsInPeriod = Math.max(0, Number(doc?.comments_in_period ?? doc?.comments) || 0);
    const baseScoreViewsWeighted = views0_2h * 3 + views2_4h * 2 + views4_6h;
    const baseScoreViewsContribution = baseScoreViewsWeighted * (ENV.LEADERBOARD?.daily?.VIEW_WEIGHT ?? 1);
    const baseScoreCommentsContribution = commentsInPeriod * (ENV.LEADERBOARD?.daily?.COMMENT_WEIGHT ?? 1);
    const baseScoreOldViewsContribution = views6_12h * 0.5;

    // Rank-based penalties (additive):
    // - Weekly top 1..5: 25%, 21%, 18%, 15%, 12%
    // - Monthly top 1..5: 25%, 21%, 18%, 15%, 12%
    // If a manga is top #1 in both weekly & monthly, penalty becomes 50%.
    const weeklyRank = weeklyRankMap.get(sid) ?? null;
    const monthlyRank = monthlyRankMap.get(sid) ?? null;
    const weeklyPenalty = weeklyRank && weeklyRank <= 5 ? TOP_RANK_PENALTY[weeklyRank - 1] : 0;
    const monthlyPenalty = monthlyRank && monthlyRank <= 5 ? TOP_RANK_PENALTY[monthlyRank - 1] : 0;
    const penalty = weeklyPenalty + monthlyPenalty;
    const penaltyMultiplier = 1 - penalty;

    // Genre penalty: if manga has genre "manhwa", reduce score by 35%.
    // Apply to manga only (not COSPLAY).
    const contentType = (story as any)?.contentType ?? MANGA_CONTENT_TYPE.MANGA;
    const genres = Array.isArray((story as any)?.genres) ? ((story as any).genres as unknown[]) : [];
    const hasManhwaGenre =
      (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) &&
      genres.some((g) => typeof g === "string" && g.trim().toLowerCase() === "manhwa");
    const genreMultiplier = hasManhwaGenre ? 0.65 : 1;

    // Disturbing tags (guro/scat): -50% score and no recent bonus.
    const genreSlugs = genres
      .filter((g) => typeof g === "string")
      .map((g) => toSlug(String(g)).toLowerCase());
    const hasDisturbingTags =
      (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) &&
      (genreSlugs.includes("guro") || genreSlugs.includes("scat"));
    const disturbingMultiplier = hasDisturbingTags ? 0.5 : 1;

    // Recent bonus applies to manga only (contentType MANGA/null) and uses updatedAt as proxy for latest chapter time.
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
    // Do NOT apply recent bonus for manhwa or disturbing tags.
    const recentMultiplier = isRecent && !hasManhwaGenre && !hasDisturbingTags ? 1.25 : 1;

    const adjustedScore = baseScore * penaltyMultiplier * recentMultiplier * genreMultiplier * disturbingMultiplier;

    return {
      baseScore,
      baseScoreViewsWeighted,
      baseScoreViewsContribution,
      baseScoreCommentsContribution,
      baseScoreOldViewsContribution,
      weeklyRank,
      monthlyRank,
      weeklyPenalty,
      monthlyPenalty,
      penalty,
      penaltyMultiplier,
      isRecent,
      recentMultiplier,
      hasManhwaGenre,
      genreMultiplier,
      hasDisturbingTags,
      disturbingMultiplier,
      adjustedScore,
    };
  };

  // Re-rank documents using adjusted score (tie-break by base score then most recent interaction).
  const rankedDocs = [...leaderboardDocs].sort((a: any, b: any) => {
    const aId = String(a?.story_id ?? a?._id ?? "");
    const bId = String(b?.story_id ?? b?._id ?? "");
    const aStory = storyMap.get(aId);
    const bStory = storyMap.get(bId);

    const aAdj = getHotCarouselScoreBreakdown(a, aStory).adjustedScore;
    const bAdj = getHotCarouselScoreBreakdown(b, bStory).adjustedScore;
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
    normalizeMangaAssets(story as any);
  }

  return combined;
};

export const getHotCarouselLeaderboardWithScores = async (): Promise<HotCarouselScoreRow[]> => {
  const leaderboardDocs = await InteractionModel.aggregate(buildHotCarouselPipeline(HOT_CAROUSEL_PIPELINE_LIMIT) as any);
  if (!leaderboardDocs?.length) return [];

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

  const stories = (await MangaModel.find({ _id: { $in: leaderboardIds } }).lean()) as any as MangaType[];
  const storyMap = new Map<string, MangaType>(
    (Array.isArray(stories) ? stories : []).map((story: MangaType) => [
      String((story as any)?._id ?? (story as any)?.id ?? ""),
      story,
    ]),
  );

  const getHotCarouselScoreBreakdown = (doc: any, story?: MangaType | null): HotCarouselScoreBreakdown => {
    const sid = String(doc?.story_id ?? doc?._id ?? "");
    const baseScore = typeof doc?.score === "number" ? doc.score : 0;

    // Base score breakdown (daily rolling pipeline buckets)
    const views0_2h = Math.max(0, Number(doc?.views_0_2h) || 0);
    const views2_4h = Math.max(0, Number(doc?.views_2_4h) || 0);
    const views4_6h = Math.max(0, Number(doc?.views_4_6h) || 0);
    const views6_12h = Math.max(0, Number(doc?.views_6_12h) || 0);
    const commentsInPeriod = Math.max(0, Number(doc?.comments_in_period ?? doc?.comments) || 0);
    const baseScoreViewsWeighted = views0_2h * 3 + views2_4h * 2 + views4_6h;
    const baseScoreViewsContribution = baseScoreViewsWeighted * (ENV.LEADERBOARD?.daily?.VIEW_WEIGHT ?? 1);
    const baseScoreCommentsContribution = commentsInPeriod * (ENV.LEADERBOARD?.daily?.COMMENT_WEIGHT ?? 1);
    const baseScoreOldViewsContribution = views6_12h * 0.5;

    const weeklyRank = weeklyRankMap.get(sid) ?? null;
    const monthlyRank = monthlyRankMap.get(sid) ?? null;
    const weeklyPenalty = weeklyRank && weeklyRank <= 5 ? TOP_RANK_PENALTY[weeklyRank - 1] : 0;
    const monthlyPenalty = monthlyRank && monthlyRank <= 5 ? TOP_RANK_PENALTY[monthlyRank - 1] : 0;
    const penalty = weeklyPenalty + monthlyPenalty;
    const penaltyMultiplier = 1 - penalty;

    // Genre penalty: if manga has genre "manhwa", reduce score by 35%.
    // Apply to manga only (not COSPLAY).
    const contentType = (story as any)?.contentType ?? MANGA_CONTENT_TYPE.MANGA;
    const genres = Array.isArray((story as any)?.genres) ? ((story as any).genres as unknown[]) : [];
    const hasManhwaGenre =
      (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) &&
      genres.some((g) => typeof g === "string" && g.trim().toLowerCase() === "manhwa");
    const genreMultiplier = hasManhwaGenre ? 0.65 : 1;

    const genreSlugs = genres
      .filter((g) => typeof g === "string")
      .map((g) => toSlug(String(g)).toLowerCase());
    const hasDisturbingTags =
      (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) &&
      (genreSlugs.includes("guro") || genreSlugs.includes("scat"));
    const disturbingMultiplier = hasDisturbingTags ? 0.5 : 1;

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
    // Do NOT apply recent bonus for manhwa or disturbing tags.
    const recentMultiplier = isRecent && !hasManhwaGenre && !hasDisturbingTags ? 1.25 : 1;

    const adjustedScore = baseScore * penaltyMultiplier * recentMultiplier * genreMultiplier * disturbingMultiplier;

    return {
      baseScore,
      baseScoreViewsWeighted,
      baseScoreViewsContribution,
      baseScoreCommentsContribution,
      baseScoreOldViewsContribution,
      weeklyRank,
      monthlyRank,
      weeklyPenalty,
      monthlyPenalty,
      penalty,
      penaltyMultiplier,
      isRecent,
      recentMultiplier,
      hasManhwaGenre,
      genreMultiplier,
      hasDisturbingTags,
      disturbingMultiplier,
      adjustedScore,
    };
  };

  const rankedDocs = [...leaderboardDocs].sort((a: any, b: any) => {
    const aId = String(a?.story_id ?? a?._id ?? "");
    const bId = String(b?.story_id ?? b?._id ?? "");
    const aStory = storyMap.get(aId);
    const bStory = storyMap.get(bId);

    const aAdj = getHotCarouselScoreBreakdown(a, aStory).adjustedScore;
    const bAdj = getHotCarouselScoreBreakdown(b, bStory).adjustedScore;
    if (bAdj !== aAdj) return bAdj - aAdj;

    const aBase = typeof a?.score === "number" ? a.score : 0;
    const bBase = typeof b?.score === "number" ? b.score : 0;
    if (bBase !== aBase) return bBase - aBase;

    const aT = a?.last_interaction_at instanceof Date ? a.last_interaction_at.getTime() : (a?.last_interaction_at ? new Date(a.last_interaction_at).getTime() : 0);
    const bT = b?.last_interaction_at instanceof Date ? b.last_interaction_at.getTime() : (b?.last_interaction_at ? new Date(b.last_interaction_at).getTime() : 0);
    return bT - aT;
  });

  const mangaList: any[] = [];
  const cosplayList: any[] = [];
  const seen = new Set<string>();
  for (const doc of rankedDocs as any[]) {
    const sid = String(doc?.story_id ?? doc?._id ?? "");
    if (!sid || seen.has(sid)) continue;
    const story = storyMap.get(sid);
    if (!story) continue;
    if ((story as any).status !== MANGA_STATUS.APPROVED) continue;

    const type = (story as any).contentType ?? MANGA_CONTENT_TYPE.MANGA;
    if (type === MANGA_CONTENT_TYPE.COSPLAY) {
      if (cosplayList.length < HOT_CAROUSEL_LIMITS.COSPLAY) {
        cosplayList.push({ doc, sid, story });
        seen.add(sid);
      }
    } else {
      if (mangaList.length < HOT_CAROUSEL_LIMITS.MANGA) {
        mangaList.push({ doc, sid, story });
        seen.add(sid);
      }
    }

    if (mangaList.length >= HOT_CAROUSEL_LIMITS.MANGA && cosplayList.length >= HOT_CAROUSEL_LIMITS.COSPLAY) {
      break;
    }
  }

  const FIRST_COSPLAY_INSERT_INDEX = 5;
  const combined: any[] = [];
  combined.push(...mangaList.slice(0, FIRST_COSPLAY_INSERT_INDEX));
  if (cosplayList.length > 0) combined.push(cosplayList[0]);
  combined.push(...mangaList.slice(FIRST_COSPLAY_INSERT_INDEX));
  if (cosplayList.length > 1) combined.push(cosplayList[1]);
  if (cosplayList.length > 2) combined.push(...cosplayList.slice(2));

  const combinedStories = combined.map((x) => x.story);
  await ensureSlugForDocs(combinedStories as any[]);
  await attachLatestChapterTitles(combinedStories);
  for (const story of combinedStories as MangaType[]) {
    if (!(story as any).id) (story as any).id = String((story as any)?._id ?? "");
    normalizeMangaAssets(story as any);
  }

  const formula = "adjusted = baseScore * (1 - (weeklyPenalty + monthlyPenalty)) * recentMultiplier * genreMultiplier * disturbingMultiplier";

  const rows: HotCarouselScoreRow[] = [];
  for (let i = 0; i < combined.length; i++) {
    const { doc, sid, story } = combined[i];
    const breakdown = getHotCarouselScoreBreakdown(doc, story);
    const lastInteractionAt = doc?.last_interaction_at
      ? (doc.last_interaction_at instanceof Date ? doc.last_interaction_at.toISOString() : new Date(doc.last_interaction_at).toISOString())
      : null;

    const steps: string[] = [];
    steps.push("BASE SCORE (daily rolling 6h buckets)");
    steps.push(`views_0_2h=${Math.max(0, Number((doc as any)?.views_0_2h) || 0)}, views_2_4h=${Math.max(0, Number((doc as any)?.views_2_4h) || 0)}, views_4_6h=${Math.max(0, Number((doc as any)?.views_4_6h) || 0)}`);
    steps.push(`views_6_12h=${Math.max(0, Number((doc as any)?.views_6_12h) || 0)}, comments_0_6h=${Math.max(0, Number((doc as any)?.comments_in_period ?? (doc as any)?.comments) || 0)}`);
    steps.push(`viewsWeighted = v0_2h*3 + v2_4h*2 + v4_6h = ${breakdown.baseScoreViewsWeighted}`);
    steps.push(`viewsScore = viewsWeighted * VIEW_WEIGHT(${ENV.LEADERBOARD?.daily?.VIEW_WEIGHT ?? 1}) = ${breakdown.baseScoreViewsContribution}`);
    steps.push(`commentScore = comments * COMMENT_WEIGHT(${ENV.LEADERBOARD?.daily?.COMMENT_WEIGHT ?? 1}) = ${breakdown.baseScoreCommentsContribution}`);
    steps.push(`oldViewsScore = views_6_12h * 0.5 = ${breakdown.baseScoreOldViewsContribution}`);
    steps.push(`baseScore = viewsScore + commentScore + oldViewsScore = ${breakdown.baseScore}`);
    steps.push("\nADJUSTMENTS");
    steps.push(`weeklyRank=${breakdown.weeklyRank ?? "-"}, weeklyPenalty=${breakdown.weeklyPenalty}`);
    steps.push(`monthlyRank=${breakdown.monthlyRank ?? "-"}, monthlyPenalty=${breakdown.monthlyPenalty}`);
    steps.push(`penaltyTotal = ${breakdown.penalty} => penaltyMultiplier = ${breakdown.penaltyMultiplier}`);
    steps.push(`recent: ${breakdown.isRecent && !breakdown.hasManhwaGenre && !breakdown.hasDisturbingTags ? "+25%" : "no"} => recentMultiplier = ${breakdown.recentMultiplier}`);
    steps.push(`genre manhwa: ${breakdown.hasManhwaGenre ? "-35%" : "no"} => genreMultiplier = ${breakdown.genreMultiplier}`);
    steps.push(`tags guro/scat: ${breakdown.hasDisturbingTags ? "-50%" : "no"} => disturbingMultiplier = ${breakdown.disturbingMultiplier}`);
    steps.push(`adjustedScore = ${breakdown.baseScore} * ${breakdown.penaltyMultiplier} * ${breakdown.recentMultiplier} * ${breakdown.genreMultiplier} * ${breakdown.disturbingMultiplier} = ${breakdown.adjustedScore}`);

    rows.push({
      rank: i + 1,
      id: sid,
      story,
      baseScore: breakdown.baseScore,
      adjustedScore: breakdown.adjustedScore,
      breakdown,
      steps,
      formula,
      lastInteractionAt,
    });
  }

  return rows;
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
