import { redirect, useLoaderData } from "react-router";

import { getChapterByMangaIdAndSlug } from "@/queries/chapter.query";
import { getMangaPublishedById, getRecommendedByFeaturedGenres } from "@/queries/manga.query";
import { getUserInfoFromSession } from "@/services/session.svc";

import { ChapterDetail } from "~/components/chapter-detail";
import { CHAPTER_STATUS } from "~/constants/chapter";
import { DEFAULT_SHARE_IMAGE } from "~/constants/share-images";
import { ChapterModel } from "~/database/models/chapter.model";
import { ReadingRewardModel } from "~/database/models/reading-reward.model";
import { UserChapterReactionModel } from "~/database/models/user-chapter-reaction.model";
import type { UserType } from "~/database/models/user.model";
import { getChapterDisplayName } from "~/utils/chapter.utils";

const READING_REWARD_RATE_LIMIT_MS = 60_000;
const READING_REWARD_MAX_PER_DAY = 3;

function getTodayInVietnam(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function loader({ params, request }: any) {
  const mangaHandle = String(params?.mangaSlug || "");
  const incomingChapterSlug = String(params?.chapterSlug || "");

  if (!mangaHandle || !incomingChapterSlug) {
    throw new Response("Không tìm thấy chapter", { status: 404 });
  }

  const url = new URL(request.url);
  const { getCanonicalOrigin } = await import("~/.server/utils/canonical-url");
  const { hasRestrictedGenres } = await import("~/.server/utils/seo-blocklist");
  const origin = getCanonicalOrigin(request as any);
  const user = await getUserInfoFromSession(request);

  const manga = await getMangaPublishedById(mangaHandle, user);
  if (!manga) {
    throw new Response("Không tìm thấy truyện", { status: 404 });
  }

  // Canonicalize manga slug
  const canonicalMangaSlug = String(manga.slug || "").toLowerCase();
  const incomingMangaSlug = mangaHandle.toLowerCase();
  if (canonicalMangaSlug && incomingMangaSlug && canonicalMangaSlug !== incomingMangaSlug) {
    const target = `/truyen-hentai/${manga.slug}/${encodeURIComponent(incomingChapterSlug)}`;
    return redirect(encodeURI(target + url.search), { status: 301 });
  }

  const chapter = await getChapterByMangaIdAndSlug(
    manga.id,
    incomingChapterSlug,
    user as UserType,
  );

  if (!chapter) {
    throw new Response("Không tìm thấy chapter", { status: 404 });
  }

  // Normalize ids so the client can reliably call APIs using `mangaId + chapterSlug`
  // even if some downstream code expects string values.
  const chapterId = String((chapter as any).id ?? (chapter as any)._id ?? "").trim();
  const chapterMangaId = String((chapter as any).mangaId ?? manga.id ?? "").trim();
  const userReaction = user && chapterId
    ? ((await UserChapterReactionModel.findOne({ userId: user.id, chapterId })
        .select({ reaction: 1 })
        .lean()) as any)?.reaction ?? null
    : null;

  // Canonicalize chapter slug
  const canonicalChapterSlug = String((chapter as any).slug || "").toLowerCase();
  if (canonicalChapterSlug && canonicalChapterSlug !== incomingChapterSlug.toLowerCase()) {
    const targetMangaHandle = manga.slug || manga.id;
    const target = `/truyen-hentai/${targetMangaHandle}/${encodeURIComponent((chapter as any).slug)}`;
    return redirect(encodeURI(target + url.search), { status: 301 });
  }

  const detailPath = manga.slug ? `/truyen-hentai/${manga.slug}` : `/truyen-hentai/${manga.id}`;

  let rewardEligibility: { canClaim: boolean; remaining: number; nextEligibleAt?: string } | null = null;
  if (user?.id) {
    try {
      const now = new Date();
      const today = getTodayInVietnam(now);
      const doc = await ReadingRewardModel.findOne({ userId: String(user.id), date: today })
        .select({ rewardCount: 1, updatedAt: 1 })
        .lean();

      const rewardCount = typeof doc?.rewardCount === "number" ? doc.rewardCount : 0;
      const remaining = Math.max(0, READING_REWARD_MAX_PER_DAY - rewardCount);
      const lastUpdatedAt = doc?.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
      const nextEligibleAtMs = lastUpdatedAt ? lastUpdatedAt + READING_REWARD_RATE_LIMIT_MS : 0;
      const isCooldownPassed = !lastUpdatedAt || lastUpdatedAt < now.getTime() - READING_REWARD_RATE_LIMIT_MS;
      const canClaim = remaining > 0 && isCooldownPassed;

      rewardEligibility = {
        canClaim,
        remaining,
        nextEligibleAt: !canClaim && nextEligibleAtMs ? new Date(nextEligibleAtMs).toISOString() : undefined,
      };
    } catch {
      rewardEligibility = { canClaim: false, remaining: 0 };
    }
  }

  const chapterDisplayName = getChapterDisplayName((chapter as any).title, (chapter as any).chapterNumber);
  const breadcrumb = `Trang chủ / ${manga?.title || "Manga"} / ${chapterDisplayName}`;
  const breadcrumbItems = [
    { label: "Trang chủ", href: "/" },
    { label: manga?.title || "Manga", href: detailPath },
    { label: chapterDisplayName },
  ];

  // Prev/next by STT, but return both number + slug for routing
  let preChapter: any;
  let nextChapter: any;
  const statuses = [CHAPTER_STATUS.APPROVED, CHAPTER_STATUS.PENDING];
  const currentNumber = Number((chapter as any).chapterNumber);

  if (Number.isFinite(currentNumber)) {
    preChapter = await ChapterModel.findOne({
      mangaId: manga.id,
      status: { $in: statuses },
      chapterNumber: { $lt: currentNumber },
    })
      .select("chapterNumber slug")
      .sort({ chapterNumber: -1 })
      .lean();

    nextChapter = await ChapterModel.findOne({
      mangaId: manga.id,
      status: { $in: statuses },
      chapterNumber: { $gt: currentNumber },
    })
      .select("chapterNumber slug")
      .sort({ chapterNumber: 1 })
      .lean();
  }

  return {
    chapter: {
      ...(chapter as any),
      id: chapterId || String((chapter as any).id ?? ""),
      _id: chapterId || String((chapter as any)._id ?? ""),
      mangaId: chapterMangaId,
      mangaSlug: manga.slug,
      userReaction,
      breadcrumb,
      breadcrumbItems,
      hasPrevious: Boolean(preChapter),
      hasNext: Boolean(nextChapter),
      previousChapterNumber: preChapter?.chapterNumber,
      nextChapterNumber: nextChapter?.chapterNumber,
      previousChapterSlug: preChapter?.slug,
      nextChapterSlug: nextChapter?.slug,
    },
    recommendedManga: await getRecommendedByFeaturedGenres(manga, 10),
    isLoggedIn: !!user,
    rewardEligibility,
    mangaTitle: manga.title,
    shareImage: manga.shareImage || manga.poster,
    origin,
    robotsNoIndex: hasRestrictedGenres(manga.genres),
  };
}

export function meta({ data }: any) {
  if (!data?.chapter) {
    return [
      { title: "Không tìm thấy chương | VinaHentai" },
      { name: "description", content: "Chương truyện không tồn tại" },
    ];
  }

  const robots = data?.robotsNoIndex
    ? [{ name: "robots", content: "noindex, nofollow, noarchive, noimageindex" }]
    : [];

  const chapName = data.chapter.title?.trim()
    ? data.chapter.title
    : `Chap ${data.chapter.chapterNumber}`;
  const mangaTitle = data.mangaTitle ?? "VinaHentai";
  const origin = data.origin || "https://vinahentai.fun";

  const mangaSlugOrId = data.chapter.mangaSlug || data.chapter.mangaId || "";
  const chapterSlug = data.chapter.slug || "";
  const canonicalUrl = `${origin}/truyen-hentai/${encodeURIComponent(mangaSlugOrId)}/${encodeURIComponent(chapterSlug)}`;

  const description = `Đọc ${chapName} của ${mangaTitle}`;
  const image = data.shareImage || DEFAULT_SHARE_IMAGE;

  return [
    { title: `${chapName} | ${mangaTitle}` },
    { name: "description", content: description },
    { property: "og:type", content: "article" },
    { property: "og:title", content: `${chapName} | ${mangaTitle}` },
    { property: "og:description", content: description },
    { property: "og:url", content: canonicalUrl },
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: `${chapName} | ${mangaTitle}` },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
    { name: "twitter:url", content: canonicalUrl },
    ...robots,
  ];
}

export default function ChapterReader() {
  const { chapter, recommendedManga, isLoggedIn, rewardEligibility } = useLoaderData<typeof loader>();

  return (
    <div className="container-page mx-auto overflow-x-hidden px-4 py-6 sm:px-6">
      <ChapterDetail
        chapter={{
          ...chapter,
          hasPrevious: Boolean(chapter.hasPrevious),
          hasNext: Boolean(chapter.hasNext),
        }}
        isEnableClaimReward={Boolean(rewardEligibility?.canClaim)}
        rewardEligibility={rewardEligibility}
        recommendedManga={recommendedManga}
        isLoggedIn={isLoggedIn}
      />
    </div>
  );
}
