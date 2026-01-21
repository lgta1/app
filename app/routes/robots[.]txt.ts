import type { LoaderFunctionArgs } from "react-router-dom";

const getHost = (request: Request): string => {
  const forwarded = (request.headers.get("x-forwarded-host") ?? "").trim();
  const hostHeader = (request.headers.get("host") ?? "").trim();
  const raw = (forwarded || hostHeader).split(",")[0]?.trim() ?? "";
  return raw.replace(/:\d+$/, "").replace(/^www\./i, "").toLowerCase();
};

export async function loader({ request }: LoaderFunctionArgs) {
  const host = getHost(request);

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
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  }

  // Primary domain: allow crawling (SEO rules handled elsewhere).
  return new Response("User-agent: *\nAllow: /\n\n# Posts are disabled and should be removed from index.\n# Do NOT block via robots.txt, so crawlers can fetch and observe 410/404.\n", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
