import { createRequestListener } from "@react-router/node";
import dotenv from "dotenv";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NODE_ENV = process.env.NODE_ENV ?? "production";
dotenv.config({
  path: path.join(__dirname, NODE_ENV === "production" ? ".env.production" : ".env"),
  override: false,
});

const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
const MODE = NODE_ENV;

const ACCESS_LOG_ENABLED = /^(1|true|yes|on)$/i.test(String(process.env.ACCESS_LOG_ENABLED ?? "false"));
const ACCESS_LOG_ONLY_CLOUDFLARE = /^(1|true|yes|on)$/i.test(
  String(process.env.ACCESS_LOG_ONLY_CLOUDFLARE ?? "true"),
);
const ACCESS_LOG_SAMPLE_RATE = (() => {
  const parsed = Number.parseFloat(String(process.env.ACCESS_LOG_SAMPLE_RATE ?? "1"));
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(0, Math.min(1, parsed));
})();

const clientDir = path.join(__dirname, "build", "client");
const publicDir = path.join(__dirname, "public");

// Loaded once at startup; requires `npm run build` output.
const build = await import("./build/server/index.js");
const requestListener = createRequestListener({ build, mode: MODE });

const getContentType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".xml":
      return "application/xml; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".ico":
      return "image/x-icon";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
};

const shouldTryServeStatic = (pathname) => {
  if (!pathname || pathname === "/") return false;

  // Only attempt static serving for paths that look like files.
  return pathname.includes(".");
};

const isSitemapXmlPath = (pathname) => /^\/sitemap.*\.xml$/i.test(pathname);

const BOT_PROBE_404_PATTERNS = [
  /^\/wp-login\.php$/i,
  /^\/xmlrpc\.php$/i,
  /^\/wp-admin(?:\/|$)/i,
  /^\/wp-content(?:\/|$)/i,
  /^\/wp-includes(?:\/|$)/i,
  /^\/actuator(?:\/|$)/i,
  /^\/package\/dynamic_js\//i,
  /^\/\.well-known\/(?:passkey-endpoints|assetlinks\.json)$/i,
];

const isKnownBotProbePath = (pathname) => BOT_PROBE_404_PATTERNS.some((pattern) => pattern.test(pathname));

const shouldLogAccessEntry = (req) => {
  if (!ACCESS_LOG_ENABLED) return false;
  if (ACCESS_LOG_SAMPLE_RATE <= 0) return false;
  if (ACCESS_LOG_SAMPLE_RATE < 1 && Math.random() > ACCESS_LOG_SAMPLE_RATE) return false;

  if (!ACCESS_LOG_ONLY_CLOUDFLARE) return true;
  return Boolean(req.headers["cf-ray"] || req.headers["cf-connecting-ip"] || req.headers["cf-ipcountry"]);
};

const normalizeHeaderValue = (value) => {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return undefined;
};

const server = http.createServer(async (req, res) => {
  const startedAt = process.hrtime.bigint();
  const shouldLogAccess = shouldLogAccessEntry(req);
  if (shouldLogAccess) {
    res.once("finish", () => {
      try {
        const host = req.headers.host ?? "localhost";
        const url = new URL(req.url ?? "/", `http://${host}`);
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        const responseBytes = normalizeHeaderValue(res.getHeader("content-length"));
        const cacheControl = normalizeHeaderValue(res.getHeader("cache-control"));
        const cfCacheStatus = normalizeHeaderValue(req.headers["cf-cache-status"]);

        const entry = {
          ts: new Date().toISOString(),
          method: req.method,
          path: url.pathname,
          query: url.search || undefined,
          status: res.statusCode,
          durationMs: Number(durationMs.toFixed(2)),
          bytes: responseBytes ? Number.parseInt(responseBytes, 10) || undefined : undefined,
          cacheControl,
          cf: {
            ray: normalizeHeaderValue(req.headers["cf-ray"]),
            connectingIp: normalizeHeaderValue(req.headers["cf-connecting-ip"]),
            ipCountry: normalizeHeaderValue(req.headers["cf-ipcountry"]),
            visitor: normalizeHeaderValue(req.headers["cf-visitor"]),
            cacheStatus: cfCacheStatus,
          },
          hasSessionCookie: /(?:^|;\s*)__session=/.test(req.headers.cookie || ""),
          referer: normalizeHeaderValue(req.headers.referer),
          userAgent: normalizeHeaderValue(req.headers["user-agent"]),
        };

        console.log(`[origin-access] ${JSON.stringify(entry)}`);
      } catch {
        // ignore logging failures
      }
    });
  }

  try {
    const host = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/", `http://${host}`);
    const pathname = url.pathname;

    if (req.method === "GET" || req.method === "HEAD") {
      if (pathname === "/apple-touch-icon-120x120-precomposed.png") {
        res.statusCode = 301;
        res.setHeader("Location", "/apple-touch-icon-120x120.png");
        res.setHeader("Cache-Control", "public, max-age=300, s-maxage=86400");
        res.end();
        return;
      }

      if (isKnownBotProbePath(pathname)) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader(
          "Cache-Control",
          "public, max-age=60, s-maxage=86400, stale-while-revalidate=60, stale-if-error=86400",
        );
        res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
        res.end("Not Found");
        return;
      }

      if (shouldTryServeStatic(pathname) && pathname !== "/sitemap_index_online.xml") {
        const rel = decodeURIComponent(pathname).replace(/^\/+/, "");
        const staticRoots = [clientDir, publicDir];

        for (const rootDir of staticRoots) {
          const filePath = path.join(rootDir, rel);

          // Prevent path traversal.
          if (!filePath.startsWith(rootDir + path.sep)) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end("Bad Request");
            return;
          }

          try {
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
              const contentType = getContentType(filePath);
              res.statusCode = 200;
              res.setHeader("Content-Type", contentType);

              if (
                pathname.startsWith("/assets/") ||
                pathname.startsWith("/images/") ||
                pathname.startsWith("/gif-meme/") ||
                pathname.startsWith("/videos/") ||
                pathname.startsWith("/audio/")
              ) {
                res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
              } else if (pathname.endsWith(".xml")) {
                res.setHeader("Cache-Control", "public, max-age=0");
              } else {
                res.setHeader("Cache-Control", "public, max-age=300");
              }

              if (req.method === "HEAD") {
                res.end();
                return;
              }

              fs.createReadStream(filePath).pipe(res);
              return;
            }
          } catch (err) {
            // Continue to next static root.
          }
        }

        // Missing file: special-case removed sitemaps to return 404 (instead of bubbling to a 500).
        if (
          isSitemapXmlPath(pathname) &&
          pathname !== "/sitemap.xml" &&
          pathname !== "/sitemaponline.xml" &&
          pathname !== "/sitemap_index_online.xml"
        ) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.setHeader("Cache-Control", "public, max-age=300");
          res.end("Not Found");
          return;
        }
      }

      // If it's a sitemap-like path without a static file, ensure a clean 404 (except the live ones).
      if (
        isSitemapXmlPath(pathname) &&
        pathname !== "/sitemap.xml" &&
        pathname !== "/sitemaponline.xml" &&
        pathname !== "/sitemap_index_online.xml"
      ) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=300");
        res.end("Not Found");
        return;
      }
    }

    // Ensure HTML cache headers for anonymous requests (edge caching).
    // This mirrors entry.server.tsx and injects Cache-Control even if the app writes headers later.
    try {
      const cookieHeader = req.headers.cookie || "";
      const hasSession = /(?:^|;\s*)__session=/.test(cookieHeader);
      const accept = req.headers.accept || "";

      const pathname = (new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`))
        .pathname.replace(/\/+$/, "") || "/";
      const isDataRequest = pathname.endsWith(".data");
      const isApiReadRequest = pathname.startsWith("/api/") && req.method === "GET";
      const isHtmlRequest =
        req.method === "GET" &&
        !isDataRequest &&
        !isApiReadRequest &&
        (accept.includes("text/html") || accept === "" || accept.includes("*/*"));

      const isMangaDetailPage =
        /^\/truyen-hentai\/[^/]+$/.test(pathname) &&
        !pathname.startsWith("/truyen-hentai/create") &&
        !pathname.startsWith("/truyen-hentai/edit") &&
        !pathname.startsWith("/truyen-hentai/manage") &&
        !pathname.startsWith("/truyen-hentai/uploaded");

      const isChapterReadPage =
        /^\/truyen-hentai\/[^/]+\/[^/]+$/.test(pathname) && !pathname.startsWith("/truyen-hentai/chapter/");

      const edgeTtlSeconds =
        pathname === "/" ? 120 :
        pathname === "/danh-sach" ? 1800 :
        pathname === "/genres" ? 1800 :
        pathname.startsWith("/genres/") ? 3600 :
        pathname.startsWith("/translators/") ? 3600 :
        pathname.startsWith("/authors/") ? 3600 :
        pathname.startsWith("/characters/") ? 3600 :
        pathname.startsWith("/doujinshi/") ? 3600 :
        pathname === "/random" ? 3600 :
        pathname === "/gioi-thieu" ? 172800 :
        pathname === "/leaderboard" ? 86400 :
        pathname.startsWith("/leaderboard/") ? 86400 :
        pathname === "/truyen-hentai" ? 3600 :
        isMangaDetailPage ? 300 :
        isChapterReadPage ? 1800 :
        null;

      const isAllowlistedPublicPage = edgeTtlSeconds !== null;

      const applyCacheHeaders = () => {
        if (res.headersSent) return;
        if (hasSession) {
          if (!res.hasHeader("Cache-Control")) {
            res.setHeader("Cache-Control", "private, no-store, max-age=0");
          }
          const vary = res.getHeader("Vary");
          res.setHeader("Vary", vary ? `${vary}, Cookie` : "Cookie");
          return;
        }

        if (isHtmlRequest && isAllowlistedPublicPage && res.statusCode === 200 && !res.hasHeader("Cache-Control")) {
          res.setHeader(
            "Cache-Control",
            `public, max-age=0, s-maxage=${edgeTtlSeconds}, stale-while-revalidate=60, stale-if-error=86400`,
          );
          return;
        }

        const isAnonReadMissingCacheControl =
          !hasSession &&
          !isHtmlRequest &&
          req.method === "GET" &&
          res.statusCode >= 200 &&
          res.statusCode < 300 &&
          !res.hasHeader("Cache-Control") &&
          (isDataRequest || isApiReadRequest);

        if (isAnonReadMissingCacheControl) {
          res.setHeader(
            "Cache-Control",
            "public, max-age=10, s-maxage=60, stale-while-revalidate=60, stale-if-error=86400",
          );
        }
      };

      const originalWriteHead = res.writeHead;
      res.writeHead = function writeHead(statusCode, reasonPhrase, headers) {
        applyCacheHeaders();
        return originalWriteHead.call(this, statusCode, reasonPhrase, headers);
      };

      const originalEnd = res.end;
      res.end = function end(...args) {
        applyCacheHeaders();
        return originalEnd.apply(this, args);
      };
    } catch {
      // ignore cache header guard
    }

    requestListener(req, res);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Unexpected Server Error");
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT} (${MODE})`);
});
