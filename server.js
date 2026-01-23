import { createRequestListener } from "@react-router/node";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
const MODE = process.env.NODE_ENV ?? "production";

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
