import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router-dom";

export async function loader(_args: LoaderFunctionArgs) {
  try {
    const request = (_args as any)?.request as Request | undefined;
    const forwarded = (request?.headers.get("x-forwarded-host") ?? "").trim();
    const hostHeader = (request?.headers.get("host") ?? "").trim();
    const host = (forwarded || hostHeader).split(",")[0]?.trim()?.replace(/:\d+$/, "").replace(/^www\./i, "").toLowerCase();
    if (host === "vinahentai.one") {
      return new Response("Not Found", {
        status: 404,
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=300",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
        },
      });
    }
  } catch {
    // ignore
  }

  const res = redirect("/sitemap_index_fun.xml", { status: 301 });
  res.headers.set("Cache-Control", "public, max-age=300, s-maxage=300");
  return res;
}
