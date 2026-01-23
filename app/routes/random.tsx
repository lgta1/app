import { redirect } from "react-router";

import type { Route } from "./+types/random";

export async function loader({}: Route.LoaderArgs) {
  const { getRandomApprovedMangaId } = await import("@/queries/manga.query");
  const randomId = await getRandomApprovedMangaId();

  if (!randomId) {
    return redirect("/?random=empty");
  }
  const { resolveMangaHandle } = await import("~/database/helpers/manga-slug.helper");
  const manga = await resolveMangaHandle(randomId);
  const targetHandle = manga?.slug ?? randomId;
  return redirect(encodeURI(`/truyen-hentai/${targetHandle}`));
}

export default function RandomRedirect() {
  return null;
}
