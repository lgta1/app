import { redirect, useLoaderData } from "react-router";

import { getChapterByMangaIdAndSlug } from "@/queries/chapter.query";
import { getMangaPublishedById, getRecommendedByFeaturedGenres } from "@/queries/manga.query";

import { ChapterDetail } from "~/components/chapter-detail";
import { CHAPTER_STATUS } from "~/constants/chapter";
import { DEFAULT_SHARE_IMAGE } from "~/constants/share-images";
import { ChapterModel } from "~/database/models/chapter.model";
import { getChapterDisplayName } from "~/utils/chapter.utils";

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

  const manga = await getMangaPublishedById(mangaHandle);
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
  );

  if (!chapter) {
    throw new Response("Không tìm thấy chapter", { status: 404 });
  }

  // Normalize ids so the client can reliably call APIs using `mangaId + chapterSlug`
  // even if some downstream code expects string values.
  const chapterId = String((chapter as any).id ?? (chapter as any)._id ?? "").trim();
  const chapterMangaId = String((chapter as any).mangaId ?? manga.id ?? "").trim();

  // Canonicalize chapter slug
  const canonicalChapterSlug = String((chapter as any).slug || "").toLowerCase();
  if (canonicalChapterSlug && canonicalChapterSlug !== incomingChapterSlug.toLowerCase()) {
    const targetMangaHandle = manga.slug || manga.id;
    const target = `/truyen-hentai/${targetMangaHandle}/${encodeURIComponent((chapter as any).slug)}`;
    return redirect(encodeURI(target + url.search), { status: 301 });
  }

  const detailPath = manga.slug ? `/truyen-hentai/${manga.slug}` : `/truyen-hentai/${manga.id}`;

  const chapterDisplayName = getChapterDisplayName((chapter as any).title, (chapter as any).chapterNumber);
  const breadcrumb = `Trang chủ / ${manga?.title || "Manga"} / ${chapterDisplayName}`;
  const breadcrumbItems = [
    { label: "Trang chủ", href: "/" },
    { label: manga?.title || "Manga", href: detailPath },
    { label: chapterDisplayName },
  ];

  // Build compact chapter list once for client-side chapter navigation (replaces /api/chapters/list.data).
  const statuses = [CHAPTER_STATUS.APPROVED];
  const chaptersRaw = await ChapterModel.find({
    mangaId: manga.id,
    status: { $in: statuses },
  })
    .select("chapterNumber title slug")
    .sort({ chapterNumber: -1 })
    .lean();

  const chapterList = (Array.isArray(chaptersRaw) ? chaptersRaw : [])
    .map((item: any) => ({
      value: Number(item?.chapterNumber),
      label: getChapterDisplayName(item?.title, item?.chapterNumber),
      title: item?.title,
      slug: typeof item?.slug === "string" ? item.slug : undefined,
    }))
    .filter((item: any) => Number.isFinite(item.value) && item.value > 0);

  const currentNumber = Number((chapter as any).chapterNumber);
  const currentIdx = Number.isFinite(currentNumber)
    ? chapterList.findIndex((item) => Number(item.value) === currentNumber)
    : -1;

  const preChapter = currentIdx >= 0 && currentIdx + 1 < chapterList.length
    ? chapterList[currentIdx + 1]
    : undefined;
  const nextChapter = currentIdx > 0
    ? chapterList[currentIdx - 1]
    : undefined;

  return {
    chapter: {
      ...(chapter as any),
      id: chapterId || String((chapter as any).id ?? ""),
      _id: chapterId || String((chapter as any)._id ?? ""),
      mangaId: chapterMangaId,
      mangaSlug: manga.slug,
      breadcrumb,
      breadcrumbItems,
      hasPrevious: Boolean(preChapter),
      hasNext: Boolean(nextChapter),
      previousChapterNumber: preChapter?.value,
      nextChapterNumber: nextChapter?.value,
      previousChapterSlug: preChapter?.slug,
      nextChapterSlug: nextChapter?.slug,
    },
    chapterList,
    recommendedManga: await getRecommendedByFeaturedGenres(manga, 10),
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
  const origin = data.origin || "https://vinahentai.online";

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

export function shouldRevalidate({ currentUrl, nextUrl, formMethod, defaultShouldRevalidate }: any) {
  if (formMethod) return defaultShouldRevalidate;

  const samePath = currentUrl?.pathname === nextUrl?.pathname;
  const sameSearch = currentUrl?.search === nextUrl?.search;
  if (samePath && sameSearch) {
    return false;
  }

  return defaultShouldRevalidate;
}

export default function ChapterReader() {
  const { chapter, chapterList, recommendedManga } = useLoaderData<typeof loader>();

  return (
    <div className="container-page mx-auto overflow-x-hidden px-4 py-6 sm:px-6">
      <ChapterDetail
        chapter={{
          ...chapter,
          hasPrevious: Boolean(chapter.hasPrevious),
          hasNext: Boolean(chapter.hasNext),
        }}
        chapterList={chapterList}
        recommendedManga={recommendedManga}
      />
    </div>
  );
}
