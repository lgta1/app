import { useLoaderData } from "react-router";

import { getChapterByMangaIdAndNumber } from "@/queries/chapter.query";
import { getMangaPublishedById, getRelatedManga } from "@/queries/manga.query";
import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/manga.chapter.$mangaId";

import { ChapterDetail } from "~/components/chapter-detail";
import { CHAPTER_STATUS } from "~/constants/chapter";
import { ChapterModel } from "~/database/models/chapter.model";
import type { UserType } from "~/database/models/user.model";

export async function loader({ params, request }: Route.LoaderArgs) {
  const mangaId = params.mangaId;

  const url = new URL(request.url);
  const chapterNumber = Number(url.searchParams.get("chapterNumber"));
  const user = await getUserInfoFromSession(request);

  if (!mangaId) {
    throw new Response("Không tìm thấy chapter", { status: 404 });
  }

  // Lấy dữ liệu manga
  const manga = await getMangaPublishedById(mangaId, user);
  if (!manga) {
    throw new Response("Không tìm thấy truyện", { status: 404 });
  }

  // Lấy dữ liệu chapter
  const chapter = await getChapterByMangaIdAndNumber(
    mangaId,
    chapterNumber,
    user as UserType,
  );
  if (!chapter) {
    throw new Response("Không tìm thấy chapter", { status: 404 });
  }

  const breadcrumb = `Trang chủ / ${manga?.title || "Manga"} / Chapter ${chapter.chapterNumber}`;

  let preChapter, nextChapter;

  if (chapter.chapterNumber) {
    preChapter = await ChapterModel.findOne({
      mangaId,
      chapterNumber: chapter.chapterNumber - 1,
      status: { $in: [CHAPTER_STATUS.APPROVED, CHAPTER_STATUS.PENDING] },
    });

    nextChapter = await ChapterModel.findOne({
      mangaId,
      chapterNumber: chapter.chapterNumber + 1,
      status: { $in: [CHAPTER_STATUS.APPROVED, CHAPTER_STATUS.PENDING] },
    });
  }

  return {
    chapter: {
      ...chapter,
      breadcrumb,
      hasPrevious: Boolean(preChapter),
      hasNext: Boolean(nextChapter),
    },
    relatedManga: await getRelatedManga(manga),
  };
}

export function meta({ data }: Route.MetaArgs) {
  if (!data?.chapter) {
    return [
      { title: "Không tìm thấy chương | WuxiaWorld" },
      { name: "description", content: "Chương truyện không tồn tại" },
    ];
  }

  return [
    { title: `${data.chapter.title} | WuxiaWorld` },
    { name: "description", content: `Đọc ${data.chapter.title} tại WuxiaWorld` },
  ];
}

export default function ChapterReader() {
  const { chapter, relatedManga } = useLoaderData<typeof loader>();

  return (
    <div className="container-ad mx-auto px-4 py-6 sm:px-6">
      <ChapterDetail
        chapter={{
          ...chapter,
          hasPrevious: Boolean(chapter.hasPrevious),
          hasNext: Boolean(chapter.hasNext),
        }}
        isEnableClaimReward={true}
        relatedManga={relatedManga}
      />
    </div>
  );
}
