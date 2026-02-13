import type { LoaderFunctionArgs } from "react-router-dom";

const getHost = (request: Request): string => {
  const forwarded = (request.headers.get("x-forwarded-host") ?? "").trim();
  const hostHeader = (request.headers.get("host") ?? "").trim();
  const raw = (forwarded || hostHeader).split(",")[0]?.trim() ?? "";
  return raw.replace(/:\d+$/, "").replace(/^www\./i, "").toLowerCase();
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const host = getHost(request);
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

  return new Response("Not Found", {
    status: 404,
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
