import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { resolveMangaHandle } from "~/database/helpers/manga-slug.helper";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const handle = params.mangaId;
  if (!handle) {
    throw new Response("Không tìm thấy truyện", { status: 404 });
  }

  const url = new URL(request.url);
  const chapterNumberParam = url.searchParams.get("chapterNumber");
  const chapterNumber = Number(chapterNumberParam);

  const doc = await resolveMangaHandle(handle);
  const targetHandle = (doc as any)?.slug || (doc as any)?.id || (doc as any)?._id || handle;

  if (!Number.isFinite(chapterNumber) || chapterNumber < 1) {
    return redirect(`/truyen-hentai/preview/${targetHandle}`, { status: 302 });
  }

  const { getChapterByMangaIdAndNumber } = await import("@/queries/chapter.query");
  const mangaId = String((doc as any)?.id || (doc as any)?._id || "");
  if (!mangaId) {
    return redirect(`/truyen-hentai/preview/${targetHandle}`, { status: 302 });
  }

  const chapter = await getChapterByMangaIdAndNumber(mangaId, chapterNumber, null as any);
  const chapterId = String((chapter as any)?.id ?? (chapter as any)?._id ?? "").trim();
  if (!chapterId) {
    return redirect(`/truyen-hentai/preview/${targetHandle}`, { status: 302 });
  }

  url.searchParams.delete("chapterNumber");
  const rest = url.searchParams.toString();
  const target = `/truyen-hentai/chapter/edit/${encodeURIComponent(targetHandle)}/${encodeURIComponent(chapterId)}`;
  return redirect(rest ? `${target}?${rest}` : target, { status: 302 });
}

export default function MangaChapterEditLegacyRedirect() {
  return null;
}
