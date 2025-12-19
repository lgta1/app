import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const search = new URL(request.url).search;
  return redirect(`/truyen-hentai/manage${search}`, { status: 301 });
}

export default function MangaManageLegacyRedirect() {
  return null;
}
