import { useLoaderData } from "react-router";

import { getChaptersByMangaIdAndNumber } from "@/queries/chapter.query";
import { getMangaById, getMangaByIdAndOwner } from "@/queries/manga.query";
import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/manga.chapter.$mangaId";

import { ChapterDetail } from "~/components/chapter-detail";

export async function loader({ params, request }: Route.LoaderArgs) {
  const mangaId = params.mangaId;

  const url = new URL(request.url);
  const chapterNumber = Number(url.searchParams.get("chapterNumber"));

  if (!mangaId) {
    throw new Response("Không tìm thấy chapter", { status: 404 });
  }

  // Lấy dữ liệu manga
  let manga = await getMangaById(mangaId);

  if (!manga) {
    const user = await getUserInfoFromSession(request);
    if (user) {
      manga = await getMangaByIdAndOwner(mangaId, user.id);
    }
  }
  if (!manga) {
    throw new Response("Không tìm thấy truyện", { status: 404 });
  }

  // Lấy dữ liệu chapter
  const chapter = await getChaptersByMangaIdAndNumber(mangaId, chapterNumber);
  if (!chapter) {
    throw new Response("Không tìm thấy chapter", { status: 404 });
  }

  const totalChapters = manga?.chapters || 1;
  const breadcrumb = `Trang chủ / ${manga?.title || "Manga"} / Chapter ${chapter.chapterNumber}`;

  return {
    chapter: {
      ...chapter,
      breadcrumb,
      hasPrevious: chapter.chapterNumber && chapter.chapterNumber > 1,
      hasNext: chapter.chapterNumber && chapter.chapterNumber < totalChapters,
    },
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
  const { chapter } = useLoaderData<typeof loader>();

  return (
    <div className="container-ad mx-auto px-4 py-6 sm:px-6">
      <ChapterDetail
        chapter={{
          ...chapter,
          hasPrevious: Boolean(chapter.hasPrevious),
          hasNext: Boolean(chapter.hasNext),
        }}
        isEnableClaimReward={true}
      />
    </div>
  );
}
