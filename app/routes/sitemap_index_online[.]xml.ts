import type { LoaderFunctionArgs } from "react-router-dom";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const CANDIDATE_PATHS = [
  path.join(process.cwd(), "public", "sitemap_index_online.xml"),
  path.join(process.cwd(), "build", "client", "sitemap_index_online.xml"),
];

export async function loader(_args: LoaderFunctionArgs) {
  try {
    const request = (_args as any)?.request as Request | undefined;
    const forwarded = (request?.headers.get("x-forwarded-host") ?? "").trim();
    const hostHeader = (request?.headers.get("host") ?? "").trim();
    const host = (forwarded || hostHeader)
      .split(",")[0]
      ?.trim()
      ?.replace(/:\d+$/, "")
      .replace(/^www\./i, "")
      .toLowerCase();

    if (host === "vinahentai.one") {
      return new Response("Not Found", {
        status: 410,
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=300",
          "X-Robots-Tag": "noindex, nofollow, noarchive, noimageindex, nosnippet, notranslate, max-snippet:0",
        },
      });
    }
  } catch {
    // ignore
  }

  for (const filePath of CANDIDATE_PATHS) {
    try {
      await access(filePath);
      const xml = await readFile(filePath, "utf-8");
      return new Response(xml, {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=300, s-maxage=300",
        },
      });
    } catch {
      // try next path
    }
  }

  return new Response("Sitemap index not generated", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
