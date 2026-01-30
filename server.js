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

const clientDir = path.join(__dirname, "build", "client");

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

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/", `http://${host}`);
    const pathname = url.pathname;

    if (req.method === "GET" || req.method === "HEAD") {
      if (shouldTryServeStatic(pathname)) {
        const rel = decodeURIComponent(pathname).replace(/^\/+/, "");
        const filePath = path.join(clientDir, rel);

        // Prevent path traversal.
        if (!filePath.startsWith(clientDir + path.sep)) {
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

            if (pathname.startsWith("/assets/")) {
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
          // Missing file: special-case removed sitemaps to return 404 (instead of bubbling to a 500).
          if (isSitemapXmlPath(pathname) && pathname !== "/sitemap.xml" && pathname !== "/sitemapforfun2.xml") {
            res.statusCode = 404;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.setHeader("Cache-Control", "public, max-age=300");
            res.end("Not Found");
            return;
          }
        }
      }

      // If it's a sitemap-like path without a static file, ensure a clean 404 (except the live ones).
      if (isSitemapXmlPath(pathname) && pathname !== "/sitemap.xml" && pathname !== "/sitemapforfun2.xml") {
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
      const isHtmlRequest = req.method === "GET" && (accept.includes("text/html") || accept === "" || accept.includes("*/*"));

      const pathname = (new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`))
        .pathname.replace(/\/+$/, "") || "/";

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
