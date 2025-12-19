import { redirect } from "react-router";
import type { Route } from "./+types/manga.chapter.$mangaId";

// Legacy route: 301 redirect to new chapter URL prefix
export async function loader({ params, request }: Route.LoaderArgs) {
  const handle = params.mangaId;
  const url = new URL(request.url);

  if (!handle) {
    throw new Response("Không tìm thấy chapter", { status: 404 });
  }

  const { getMangaPublishedById } = await import("@/queries/manga.query");
  const { getChapterByMangaIdAndNumber } = await import("@/queries/chapter.query");
  const manga = await getMangaPublishedById(handle);
  if (!manga) {
    throw new Response("Không tìm thấy truyện", { status: 404 });
  }

  const chapterParam = url.searchParams.get("chapter") ?? url.searchParams.get("chapterNumber");
  const chapterNumber = Number(chapterParam);

  const targetHandle = manga.slug ?? handle;
  if (!Number.isFinite(chapterNumber) || chapterNumber < 1) {
    return redirect(`/truyen-hentai/${targetHandle}`, { status: 301 });
  }

  const chapter = await getChapterByMangaIdAndNumber(manga.id, chapterNumber, null as any);
  const cSlug = String((chapter as any)?.slug || "").trim();
  if (!cSlug) {
    return redirect(`/truyen-hentai/${targetHandle}`, { status: 301 });
  }

  url.searchParams.delete("chapter");
  url.searchParams.delete("chapterNumber");
  const rest = url.searchParams.toString();

  const target = `/truyen-hentai/${encodeURIComponent(targetHandle)}/${encodeURIComponent(cSlug)}`;
  return redirect(rest ? `${target}?${rest}` : target, { status: 301 });
}

export default function ChapterLegacyRedirect() {
  return null;
}
