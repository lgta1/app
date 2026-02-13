import type { RenderToPipeableStreamOptions } from "react-dom/server";
import { renderToPipeableStream } from "react-dom/server";
import type { EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import { PassThrough } from "node:stream";

import { ENV } from "@/configs/env.config";
import { initLeaderboardScheduler } from "@/jobs/leaderboard.server";
import { initHotCarouselSnapshotScheduler } from "@/jobs/hot-carousel-snapshot.server";
import { initTmpUploadCleanupScheduler } from "@/jobs/tmp-upload-cleanup.server";
import { initViHentaiAutoDownloadQueueWorker } from "@/jobs/vi-hentai-auto-download-queue.server";
import { initViHentaiAutoUpdateScheduler } from "@/jobs/vi-hentai-auto-update.server";
import { initSayHentaiAutoUpdateScheduler } from "@/jobs/sayhentai-auto-update.server";
import {
  getCanonicalHostname,
  rewriteLegacySiteHostsDeepInPlace,
  rewriteLegacySiteHostsInStream,
} from "@/utils/site-host-rewrite";

import { getRedirectUrl } from "~/.server/utils/canonical-url";

import { getCdnBase } from "~/.server/utils/cdn-url";
import {
  rewriteCdnHostsDeepInPlace,
  rewriteCdnHostsInStream,
} from "~/.server/utils/cdn-host-rewrite";

import { initMongoDB } from "~/database/connection";

export const streamTimeout = 5_000;

// Initialize MongoDB
initMongoDB();

// Initialize Leaderboard Scheduler (chỉ chạy ở production)
if (ENV.IS_PRODUCTION) {
  initLeaderboardScheduler();
  initHotCarouselSnapshotScheduler();
  initTmpUploadCleanupScheduler();
  initViHentaiAutoDownloadQueueWorker();
  initViHentaiAutoUpdateScheduler();
  initSayHentaiAutoUpdateScheduler();
}

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  // loadContext: AppLoadContext,
  // If you have middleware enabled:
  // loadContext: unstable_RouterContextProvider
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const userAgent = request.headers.get("user-agent");

    const getRequestHostname = (): string => {
      const forwardedHost = (request.headers.get("x-forwarded-host") ?? "").trim();
      const hostHeader = (request.headers.get("host") ?? "").trim();
      const rawHost = (forwardedHost || hostHeader).split(",")[0]?.trim() ?? "";
      return rawHost.replace(/:\d+$/, "").replace(/^www\./i, "").toLowerCase();
    };

    // Legacy domains must ALWAYS redirect to the primary domain for every path.
    // (Do this here so it also applies to /robots.txt, /sitemap.xml, etc.)
    try {
      const hostname = getRequestHostname();
      const isLegacy =
        hostname === "vinahentai.top" ||
        hostname === "vinahentai.xyz" ||
        hostname === "vinahentai.com" ||
        hostname === "vinahentai.fun";
      if (isLegacy) {
        const target = getRedirectUrl(request as any);
        const headers = new Headers(responseHeaders);
        headers.set("Location", target);
        // Cache the redirect at the edge; it rarely changes.
        headers.set("Cache-Control", "public, max-age=300, s-maxage=86400");
        resolve(new Response(null, { status: 301, headers }));
        return;
      }
    } catch {
      // ignore
    }

    // Backup domain should not be indexed.
    try {
      const hostname = getRequestHostname();
      if (hostname === "vinahentai.one") {
        responseHeaders.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      }
    } catch {
      // ignore
    }

    const hasRobotsNoIndex = (() => {
      try {
        const loaderData = routerContext.staticHandlerContext?.loaderData;
        if (!loaderData) return false;
        return Object.values(loaderData).some((data) => Boolean((data as any)?.robotsNoIndex));
      } catch {
        return false;
      }
    })();

    if (hasRobotsNoIndex) {
      responseHeaders.set("X-Robots-Tag", "noindex, nofollow, noarchive, noimageindex");
    }

    const canonicalHostname = (() => {
      try {
        return getCanonicalHostname(request);
      } catch {
        return undefined;
      }
    })();

    const cdnBase = (() => {
      try {
        return getCdnBase(request as any);
      } catch {
        return undefined;
      }
    })();

    // Rewrite legacy site host strings inside serialized SSR payloads.
    // This prevents old domains (e.g. vinahentai.com) from leaking into HTML.
    try {
      if (canonicalHostname) {
        rewriteLegacySiteHostsDeepInPlace(routerContext.staticHandlerContext?.loaderData, canonicalHostname);
        rewriteLegacySiteHostsDeepInPlace(routerContext.staticHandlerContext?.actionData, canonicalHostname);
        rewriteLegacySiteHostsDeepInPlace(routerContext.staticHandlerContext?.errors, canonicalHostname);

        const originalStream = routerContext.serverHandoffStream;
        const rewrittenStream = rewriteLegacySiteHostsInStream(originalStream, canonicalHostname);

        // Prefer replacing the stream on the context (normal path)
        if (rewrittenStream && rewrittenStream !== originalStream) {
          try {
            routerContext.serverHandoffStream = rewrittenStream;
          } catch {
            // Some runtimes may define this property as non-writable.
          }

          // Fallback: patch getReader on the original stream instance.
          if (originalStream) {
            try {
              (originalStream as unknown as { getReader: () => ReadableStreamDefaultReader<Uint8Array> }).getReader =
                () => rewrittenStream.getReader();
            } catch {
              // ignore
            }
          }
        }
      }
    } catch {
      // Never block rendering on rewrite logic.
    }

    // Rewrite CDN URLs (both legacy and current) to match the incoming site host.
    // This ensures the backup domain can fully render even when the primary domain/CDN is blocked.
    try {
      if (cdnBase) {
        rewriteCdnHostsDeepInPlace(routerContext.staticHandlerContext?.loaderData, cdnBase);
        rewriteCdnHostsDeepInPlace(routerContext.staticHandlerContext?.actionData, cdnBase);
        rewriteCdnHostsDeepInPlace(routerContext.staticHandlerContext?.errors, cdnBase);

        const currentStream = routerContext.serverHandoffStream;
        const nextStream = rewriteCdnHostsInStream(currentStream, cdnBase);

        if (nextStream && nextStream !== currentStream) {
          try {
            routerContext.serverHandoffStream = nextStream;
          } catch {
            // Some runtimes may define this property as non-writable.
          }

          if (currentStream) {
            try {
              (currentStream as unknown as { getReader: () => ReadableStreamDefaultReader<Uint8Array> }).getReader =
                () => nextStream.getReader();
            } catch {
              // ignore
            }
          }
        }
      }
    } catch {
      // Never block rendering on rewrite logic.
    }

    // ---------------------------------------------------------------------
    // Origin cache headers (Cloudflare-friendly)
    // Goal: cache only anonymous, public HTML pages at the edge.
    // - If user has a session cookie: NEVER cache (private/no-store).
    // - If anonymous and path is allowlisted: cache at edge via s-maxage.
    // ---------------------------------------------------------------------
    try {
      const url = new URL(request.url);
      const pathname = (url.pathname.replace(/\/+$/, "") || "/") as string;
      const cookieHeader = request.headers.get("Cookie") || "";
      const hasSession = /(?:^|;\s*)__session=/.test(cookieHeader);
      const accept = request.headers.get("Accept") || "";
      const isHtmlRequest = request.method === "GET" && (accept.includes("text/html") || accept === "" || accept.includes("*/*"));

      const isManifestRequest = request.method === "GET" && pathname === "/__manifest";

      // Allowlist ONLY the pages you want cached across anonymous users.
      // Keep admin/auth/edit/manage/upload pages out.
      const isMangaDetailPage =
        /^\/truyen-hentai\/[^/]+$/.test(pathname) &&
        !pathname.startsWith("/truyen-hentai/create") &&
        !pathname.startsWith("/truyen-hentai/edit") &&
        !pathname.startsWith("/truyen-hentai/manage") &&
        !pathname.startsWith("/truyen-hentai/uploaded");

      const isChapterReadPage =
        /^\/truyen-hentai\/[^/]+\/[^/]+$/.test(pathname) && !pathname.startsWith("/truyen-hentai/chapter/");

      // TTL yêu cầu (edge = s-maxage):
      // /: 2p, /danh-sach: 30p, /genres: 30p, /genres/*: 1h,
      // /translators/*: 1h, /authors/*: 1h, /characters/*: 1h, /doujinshi/*: 1h
      // /random: 1h, /gioi-thieu: 48h, /leaderboard/*: 24h
      // /truyen-hentai: 1h, /truyen-hentai/:slug: 5p, /truyen-hentai/:mangaSlug/:chapterSlug: 30p
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

      const isAllowlistedPublicPage = edgeTtlSeconds !== null && !hasRobotsNoIndex;

      if (isManifestRequest && responseStatusCode >= 200 && responseStatusCode < 300) {
        // /__manifest là request “nóng” do React Router lazy route discovery.
        // Nó không chứa dữ liệu cá nhân, nên cache được để giảm request về origin.
        responseHeaders.set(
          "Cache-Control",
          "public, max-age=300, s-maxage=3600, stale-while-revalidate=600, stale-if-error=86400",
        );
      } else if (hasSession || hasRobotsNoIndex) {
        responseHeaders.set("Cache-Control", "private, no-store, max-age=0");
        // Make it explicit this varies by Cookie for downstream caches.
        const vary = responseHeaders.get("Vary");
        responseHeaders.set("Vary", vary ? `${vary}, Cookie` : "Cookie");
      } else if (responseStatusCode === 200 && isHtmlRequest && isAllowlistedPublicPage) {
        // Cache at edge (Cloudflare) but revalidate at browser.
        // Tune values later via Cloudflare Cache Rules if needed.
        responseHeaders.set(
          "Cache-Control",
          `public, max-age=0, s-maxage=${edgeTtlSeconds}, stale-while-revalidate=60, stale-if-error=86400`,
        );
      }
    } catch {
      // Never block rendering on cache header logic.
    }

    // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
    // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
    const readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || routerContext.isSpaMode
        ? "onAllReady"
        : "onShellReady";

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          const responseStream = (() => {
            if (!canonicalHostname) return stream;
            try {
              return rewriteLegacySiteHostsInStream(stream, canonicalHostname);
            } catch {
              return stream;
            }
          })();

          responseHeaders.set("Content-Type", "text/html");

          resolve(
            new Response(responseStream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          // Log streaming rendering errors from inside the shell.  Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            console.error(error);
          }
        },
      },
    );

    // Abort the rendering stream after the `streamTimeout` so it has time to
    // flush down the rejected boundaries
    setTimeout(abort, streamTimeout + 1000);
  });
}
