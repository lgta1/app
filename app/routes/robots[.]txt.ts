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
  const origin = getOrigin(request);

  // Backup domain: explicitly block all crawlers.
  if (host === "vinahentai.one") {
    // Cloudflare may inject a managed `User-agent: *` group before ours.
    // Many crawlers (incl. Googlebot) pick the most specific matching group,
    // so we include explicit bot groups to ensure the block still applies.
    const robots = [
      "User-agent: Googlebot",
      "Disallow: /",
      "",
      "User-agent: Googlebot-Image",
      "Disallow: /",
      "",
      "User-agent: AdsBot-Google",
      "Disallow: /",
      "",
      "User-agent: Mediapartners-Google",
      "Disallow: /",
      "",
      "User-agent: Bingbot",
      "Disallow: /",
      "",
      "User-agent: Slurp",
      "Disallow: /",
      "",
      "User-agent: DuckDuckBot",
      "Disallow: /",
      "",
      "User-agent: Baiduspider",
      "Disallow: /",
      "",
      "User-agent: Yandex",
      "Disallow: /",
      "",
      "User-agent: *",
      "Disallow: /",
      "",
    ].join("\n");

    return new Response(robots, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "X-Robots-Tag": "noindex, nofollow, noarchive, noimageindex, nosnippet, notranslate, max-snippet:0",
      },
    });
  }

  // Primary domain: allow crawling (SEO rules handled elsewhere).
  const robots = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${origin}/sitemap_index_online.xml`,
    `Sitemap: ${origin}/sitemaponline.xml`,
    "",
    "# Posts are disabled and should be removed from index.",
    "# Do NOT block via robots.txt, so crawlers can fetch and observe 410/404.",
    "",
  ].join("\n");

  return new Response(robots, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
