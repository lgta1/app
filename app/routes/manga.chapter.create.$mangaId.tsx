import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { resolveMangaHandle } from "~/database/helpers/manga-slug.helper";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const handle = params.mangaId;
  if (!handle) {
    throw new Response("Không tìm thấy truyện", { status: 404 });
  }

  const doc = await resolveMangaHandle(handle);
  const targetHandle = (doc as any)?.slug || (doc as any)?.id || (doc as any)?._id || handle;
  const search = new URL(request.url).search;
  return redirect(`/truyen-hentai/chapter/create/${targetHandle}${search}`, { status: 301 });
}

export default function MangaChapterCreateLegacyRedirect() {
  return null;
}
