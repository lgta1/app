import { redirect } from "react-router";

import { getChapterByMangaIdAndNumber } from "@/queries/chapter.query";
import { getMangaPublishedById } from "@/queries/manga.query";
import { getUserInfoFromSession } from "@/services/session.svc";

export async function loader({ params, request }: any) {
  const handle = String(params?.mangaId || "");
  if (!handle) {
    throw new Response("Không tìm thấy chapter", { status: 404 });
  }

  const url = new URL(request.url);
  const chapterParam = url.searchParams.get("chapter") ?? url.searchParams.get("chapterNumber");
  const chapterNumber = Number(chapterParam);
  const user = await getUserInfoFromSession(request);

  const manga = await getMangaPublishedById(handle, user);
  if (!manga) {
    throw new Response("Không tìm thấy truyện", { status: 404 });
  }

  const detailPath = manga.slug ? `/truyen-hentai/${manga.slug}` : `/truyen-hentai/${manga.id}`;
  if (!Number.isFinite(chapterNumber) || chapterNumber < 1) {
    return redirect(detailPath, { status: 301 });
  }

  const chapter = await getChapterByMangaIdAndNumber(manga.id, chapterNumber, user as any);
  if (!chapter || !(chapter as any).slug) {
    return redirect(detailPath, { status: 301 });
  }

  // Preserve non-chapter params (utm/ref...) while removing chapter/chapterNumber
  url.searchParams.delete("chapter");
  url.searchParams.delete("chapterNumber");
  const rest = url.searchParams.toString();

  const targetHandle = manga.slug || manga.id;
  const target = `/truyen-hentai/${encodeURIComponent(targetHandle)}/${encodeURIComponent((chapter as any).slug)}`;
  return redirect(rest ? `${target}?${rest}` : target, { status: 301 });
}

// Legacy route: always redirects, no component.
export default function LegacyChapterRedirect() {
  return null;
}
