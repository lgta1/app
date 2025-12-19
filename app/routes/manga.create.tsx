import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const search = new URL(request.url).search;
  return redirect(`/truyen-hentai/create${search}`, { status: 301 });
}

export default function MangaCreateLegacyRedirect() {
  return null;
}
