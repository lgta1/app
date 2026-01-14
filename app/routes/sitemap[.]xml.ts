import type { LoaderFunctionArgs } from "react-router-dom";
import { redirect } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const { getCanonicalOrigin } = await import("~/.server/utils/canonical-url");
  const origin = getCanonicalOrigin(request as any);
  return redirect(`${origin}/sitemap_index.xml`, { status: 301 });
}
