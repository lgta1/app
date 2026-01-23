import type { LoaderFunctionArgs } from "react-router-dom";

const getHost = (request: Request): string => {
  const forwarded = (request.headers.get("x-forwarded-host") ?? "").trim();
  const hostHeader = (request.headers.get("host") ?? "").trim();
  const raw = (forwarded || hostHeader).split(",")[0]?.trim() ?? "";
  return raw.replace(/:\d+$/, "").replace(/^www\./i, "").toLowerCase();
};

const getOrigin = (request: Request): string => {
  const url = new URL(request.url);
  const forwardedProto = (request.headers.get("x-forwarded-proto") ?? "")
    .split(",")[0]
    ?.trim();
  const proto = forwardedProto || url.protocol.replace(/:$/, "");
  const host = getHost(request);
  return host ? `${proto}://${host}` : url.origin;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const host = getHost(request);

  // Backup domain should not expose a sitemap.
  if (host === "vinahentai.one") {
    return new Response("Not Found", {
      status: 404,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  }

  const origin = getOrigin(request);
  const lastmod = new Date().toISOString();

  const urls: Array<{
    path: string;
    changefreq: "daily" | "weekly" | "monthly" | "yearly";
    priority: string;
  }> = [
    { path: "/", changefreq: "daily", priority: "1.0" },
    { path: "/truyen-hentai", changefreq: "daily", priority: "0.9" },
    { path: "/danh-sach", changefreq: "daily", priority: "0.8" },
    { path: "/genres", changefreq: "weekly", priority: "0.7" },
    { path: "/search/advanced", changefreq: "weekly", priority: "0.5" },
    { path: "/gioi-thieu", changefreq: "yearly", priority: "0.4" },
    { path: "/random", changefreq: "daily", priority: "0.3" },
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n` +
          `    <loc>${origin}${u.path}</loc>\n` +
          `    <lastmod>${lastmod}</lastmod>\n` +
          `    <changefreq>${u.changefreq}</changefreq>\n` +
          `    <priority>${u.priority}</priority>\n` +
          `  </url>`
      )
      .join("\n") +
    `\n</urlset>\n`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
