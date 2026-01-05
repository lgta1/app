import { redirect } from "react-router";
import type { Route } from "./+types/manga.$id";

// Giữ route cũ để redirect 301 sang đường dẫn mới nhằm bảo toàn SEO và trải nghiệm người dùng
export async function loader({ params, request }: Route.LoaderArgs) {
  const { getMangaPublishedById } = await import("@/queries/manga.query");
  const handle = params.id;

  if (!handle) {
    throw new Response("Không tìm thấy truyện", { status: 404 });
  }

  const manga = await getMangaPublishedById(handle);
  if (!manga) {
    throw new Response("Không tìm thấy truyện", { status: 404 });
  }

  const targetHandle = manga.slug ?? manga.id;
  const currentUrl = new URL(request.url);
  const targetPath = `/truyen-hentai/${targetHandle}`;
  const targetUrl = `${targetPath}${currentUrl.search}`;

  // Tránh redirect nhiều bước: luôn chuyển thẳng sang URL mới
  if (currentUrl.pathname === targetPath) {
    return redirect(encodeURI(targetUrl));
  }

  return redirect(encodeURI(targetUrl), { status: 301 });
}

export default function MangaLegacyRedirect() {
  return null;
}
