import type { LoaderFunctionArgs } from "react-router-dom";
import { readFile } from "node:fs/promises";
import path from "node:path";

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

  try {
    const sitemapPath = path.join(process.cwd(), "public", "sitemaponline.xml");
    const xml = await readFile(sitemapPath, "utf-8");
    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/sitemaponline.xml",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  }
}
