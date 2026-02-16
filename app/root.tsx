// app/root.tsx
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  redirect,
} from "react-router";
import { useLocation, useNavigate, useRevalidator } from "react-router-dom";

import type { Route } from "./+types/root";

import { getAllGenres } from "@/queries/genres.query";
import { getNotificationsWithUnreadCount } from "~/.server/queries/notification.query";
import { getUserInfoFromSession } from "@/services/session.svc";
import { ErrorBoundary as CustomErrorBoundary } from "~/components/error-boundary";
import { Footer } from "~/components/footer";
import { Header } from "~/components/header";
import { NotificationsProvider } from "~/context/notifications-context";
import type { NotificationType } from "~/database/models/notification.model";
import { DEFAULT_SHARE_IMAGE } from "~/constants/share-images";
import { isAdmin } from "~/helpers/user.helper";
import DialogWarningAdultContent from "~/components/dialog-warning-adult-content";
import { json } from "~/utils/json.server";
import { getDefaultBlacklistTagSlugs } from "~/constants/blacklist-tags";

import appStylesheetUrl from "./app.css?url";

const BAN_CHECK_INTERVAL_MINUTES = 1;
const BAN_CHECK_INTERVAL_MS = BAN_CHECK_INTERVAL_MINUTES * 60 * 1000;
const LAST_BAN_CHECK_KEY = "lastBanCheck";

const GA4_MEASUREMENT_ID = "G-BDQQK9ZZBJ";
const ENABLE_GA4 = import.meta.env.PROD;

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: appStylesheetUrl },
  { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
  { rel: "shortcut icon", href: "/favicon.ico" },
  { rel: "preconnect", href: "https://cdn.vinahentai.online", crossOrigin: "anonymous" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  // Google Fonts stylesheets are deferred and preloaded
  // { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" },
  // { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap" },
  // { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Irish+Grover&display=swap" },
];

export function meta({ data }: Route.MetaArgs) {
  const baseTitle = "Vinahentai - Đọc truyện hentai 18+ KHÔNG QUẢNG CÁO";
  const description =
    "Vinahentai - Trang đọc truyện hentai, manhwa 18+ vietsub, hentaiVN,... KHÔNG QUẢNG CÁO, cập nhật nhanh, đa dạng thể loại. Trải nghiệm ngay!";
  const canonicalUrl = (data as any)?.canonicalUrl || (data as any)?.origin;
  const image = DEFAULT_SHARE_IMAGE;
  return [
    { title: baseTitle },
    { name: "description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Vinahentai" },
    { property: "og:title", content: baseTitle },
    { property: "og:description", content: description },
    ...(canonicalUrl ? [{ property: "og:url", content: canonicalUrl }] : []),
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: baseTitle },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
    ...(canonicalUrl ? [{ name: "twitter:url", content: canonicalUrl }] : []),
  ];
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useLoaderData<RootLoaderData | undefined>();
  const canonicalUrl = data?.canonicalUrl;
  const cdnBase = data?.cdnBase;
  const fontStylesheets = [
    "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap",
    "https://fonts.googleapis.com/css2?family=Irish+Grover&display=swap",
  ];
  const htmlStyle = cdnBase
    ? ({
        "--cdn-base": cdnBase,
        "--cdn-bg-body": `url(${cdnBase}/avatar-uploads/bg/bgreal2.webp)`,
      } as CSSProperties)
    : undefined;

  return (
    <html lang="vi" style={htmlStyle}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}
        <link rel="preload" as="style" href={appStylesheetUrl} />
        {fontStylesheets.map((href) => (
          <link key={href} rel="preload" as="style" href={href} />
        ))}
        {ENABLE_GA4 ? (
          <>
            {/* Google tag (gtag.js) */}
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${GA4_MEASUREMENT_ID}', { send_page_view: false });
                `,
              }}
            />
          </>
        ) : null}
        {/* Early toggle: allow disabling external Google Fonts via ?nofonts=1 or localStorage */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try{
                  var qs = location.search || '';
                  var nofonts = /(?:^|[?&])nofonts=1(?:&|$)/.test(qs) || localStorage.getItem('vh_nofonts')==='1';
                  if(nofonts){
                    localStorage.setItem('vh_nofonts','1');
                    document.documentElement.setAttribute('data-nofonts','1');
                    return;
                  }
                  var fontLinks = ${JSON.stringify(fontStylesheets)};
                  var head = document.head || document.getElementsByTagName('head')[0];
                  if (!head || !fontLinks || !fontLinks.length) return;
                  window.requestAnimationFrame(function(){
                    for (var i = 0; i < fontLinks.length; i++) {
                      var link = document.createElement('link');
                      link.rel = 'stylesheet';
                      link.href = fontLinks[i];
                      head.appendChild(link);
                    }
                  });
                }catch(_){
                  try{
                    var fontLinksFallback = ${JSON.stringify(fontStylesheets)};
                    var headFallback = document.head || document.getElementsByTagName('head')[0];
                    if (!headFallback || !fontLinksFallback || !fontLinksFallback.length) return;
                    for (var j = 0; j < fontLinksFallback.length; j++) {
                      var linkFallback = document.createElement('link');
                      linkFallback.rel = 'stylesheet';
                      linkFallback.href = fontLinksFallback[j];
                      headFallback.appendChild(linkFallback);
                    }
                  }catch(__){}
                }
              })();
            `,
          }}
        />
        <noscript>
          {fontStylesheets.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
        </noscript>
        {/* Critical inline CSS: đảm bảo khung ảnh ổn định trước khi Tailwind tải xong */}
        <style data-critical-img>{`
          .aspect-\\[2\\/3\\]{aspect-ratio:2/3}
          .aspect-\\[3\\/4\\]{aspect-ratio:3/4}
          .w-full{width:100%}
          .h-full{height:100%}
          .object-cover{object-fit:cover}
        `}</style>
        <Meta />
        <Links />
        {/* If nofonts is enabled, strip Google Fonts <link> to avoid OTS errors on some Chrome installs */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try{
                  if(document.documentElement.getAttribute('data-nofonts')==='1'){
                    var ls = document.querySelectorAll('link[rel="preconnect"][href*="fonts."] , link[rel="stylesheet"][href*="fonts."]');
                    for(var i=0;i<ls.length;i++){ var n = ls[i]; n.parentNode && n.parentNode.removeChild(n); }
                  }
                }catch(_){ }
              })();
            `,
          }}
        />
        {/* Lightweight runtime diagnostics (opt-in via ?debug=1 or localStorage.vh_debug_overlay=1) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                var debugOn = false;
                try{
                  var qs = location.search || '';
                  debugOn = /(?:^|[?&])debug=1(?:&|$)/.test(qs) || localStorage.getItem('vh_debug_overlay')==='1';
                }catch(_){ debugOn = false; }
                if(!debugOn) return;

                var installed = false;
                var hideTimer = null;
                function show(msg){
                  try{
                    var id = 'vh-boot-error';
                    var el = document.getElementById(id);
                    if(!el){
                      el = document.createElement('div');
                      el.id = id;
                      el.style.position = 'fixed';
                      el.style.left = '12px';
                      el.style.bottom = '12px';
                      el.style.zIndex = '999999';
                      el.style.background = 'rgba(190,40,255,.12)';
                      el.style.border = '1px solid rgba(190,40,255,.35)';
                      el.style.color = '#fff';
                      el.style.padding = '8px 10px';
                      el.style.borderRadius = '8px';
                      el.style.font = '12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
                      el.style.maxWidth = '90vw';
                      el.style.cursor = 'pointer';
                      el.title = 'Nhấn để đóng';
                      el.addEventListener('click', function(){ try{ el.remove(); }catch(_){ } });
                      document.body.appendChild(el);
                    }
                    el.textContent = 'Boot error: ' + msg;
                    if(hideTimer) { try{ clearTimeout(hideTimer); }catch(_){} }
                    hideTimer = setTimeout(function(){ try{ el && el.remove(); }catch(_){ } }, 12000);
                  }catch(e){}
                }
                if(!installed){
                  installed = true;
                  window.addEventListener('error', function(e){ show(e && e.message ? e.message : 'unknown error'); });
                  window.addEventListener('unhandledrejection', function(e){
                    try{ show((e&&e.reason&&e.reason.message)||String(e.reason)); }
                    catch(_){ show('unhandled rejection'); }
                  });
                }
              })();
            `,
          }}
        />
      </head>
      <body className="overflow-x-hidden">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export async function loader({ request }: Route.LoaderArgs) {
  const { sharedTtlCache } = await import("~/.server/utils/ttl-cache");
  const { isbot } = await import("isbot");
  const { getCanonicalUrl, getRedirectUrl, getCanonicalOrigin, getEffectiveRequestUrl } = await import("~/.server/utils/canonical-url");
  const { getCdnBase } = await import("~/.server/utils/cdn-url");

  // Consolidate hostname (e.g. www -> non-www), protocol (http -> https), trailing slashes
  // and common tracking params at the app layer.
  // Cloudflare should also enforce this, but this prevents duplicate content
  // and session fragmentation if edge rules are missing/misconfigured.
  const canonicalUrl = (() => {
    try {
      return getCanonicalUrl(request as any);
    } catch {
      return undefined;
    }
  })();

  const redirectUrl = (() => {
    try {
      return getRedirectUrl(request as any);
    } catch {
      return undefined;
    }
  })();

  if (redirectUrl && (request.method === "GET" || request.method === "HEAD")) {
    try {
      const effectiveUrl = getEffectiveRequestUrl(request as any);
      if (effectiveUrl.toString() !== redirectUrl) {
        return redirect(encodeURI(redirectUrl), { status: 301 });
      }
    } catch {}
  }

  const userAgent = request.headers.get("user-agent") ?? "";
  const isBot = userAgent ? isbot(userAgent) : false;

  const cookieHeader = request.headers.get("Cookie") ?? "";
  const ageVerified = /(?:^|;\s*)age_verified=1(?:;|$)/.test(cookieHeader);

  const user = await getUserInfoFromSession(request);
  const genres = await sharedTtlCache.getOrSet("genres:all", 5 * 60 * 1000, () => getAllGenres());
  const origin = (() => {
    try {
      return new URL(canonicalUrl || getCanonicalOrigin(request as any)).origin;
    } catch {
      return getCanonicalOrigin(request as any);
    }
  })();
  const cdnBase = getCdnBase(request as any).replace(/\/+$/, "");

  const responseHeaders = new Headers();
  // Prevent CDN/Cloudflare from caching HTML/data responses and serving stale asset-hash refs
  responseHeaders.set("Cache-Control", "private, no-store, max-age=0");
  responseHeaders.set("Vary", "Cookie");

  // Backup domain should not be indexed.
  try {
    const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
      .split(",")[0]
      ?.trim()
      ?.replace(/:\d+$/, "")
      ?.replace(/^www\./i, "")
      ?.toLowerCase();
    if (host === "vinahentai.one") {
      responseHeaders.set("X-Robots-Tag", "noindex, nofollow, noarchive, noimageindex, nosnippet, notranslate, max-snippet:0");
    }
  } catch {
    // ignore
  }

  if (user) {
    // Enrich session user with blacklist tags (used by MangaCard), and apply defaults once if never configured.
    try {
      const { UserModel } = await import("~/database/models/user.model");
      const doc: any = await UserModel.findById(user.id)
        .select("blacklistTags hasConfiguredBlacklistTags")
        .lean();

      const configured = Boolean(doc?.hasConfiguredBlacklistTags);
      const list = Array.isArray(doc?.blacklistTags) ? (doc.blacklistTags as string[]) : [];

      if (!configured && list.length === 0) {
        const defaults = getDefaultBlacklistTagSlugs();
        try {
          await UserModel.findByIdAndUpdate(user.id, {
            $set: { blacklistTags: defaults, hasConfiguredBlacklistTags: true },
          });
        } catch {}
        (user as any).blacklistTags = defaults;
        (user as any).hasConfiguredBlacklistTags = true;
      } else {
        (user as any).blacklistTags = list;
        (user as any).hasConfiguredBlacklistTags = configured;
      }
    } catch {
      // ignore
    }

    let unreadCount = 0;
    let initialNotifications: NotificationType[] = [];
    try {
      const result = await getNotificationsWithUnreadCount(user.id, 10);
      unreadCount = result.totalUnreadCount;
      initialNotifications = result.notifications;
    } catch {}
    return json(
      { isAdmin: isAdmin(user.role), user, genres, unreadCount, initialNotifications, isBot, ageVerified, origin, canonicalUrl, cdnBase },
      { headers: responseHeaders },
    );
  }
  return json(
    { isAdmin: false, genres, isBot, ageVerified, origin, canonicalUrl, cdnBase },
    { headers: responseHeaders },
  );
}

type RootLoaderData = {
  isAdmin: boolean;
  user?: any;
  genres: any[];
  unreadCount?: number;
  initialNotifications?: NotificationType[];
  isBot?: boolean;
  ageVerified?: boolean;
  origin?: string;
  canonicalUrl?: string;
  cdnBase?: string;
};

export default function App() {
  const data = useLoaderData<RootLoaderData | undefined>();
  const isAdminFromLoader = data?.isAdmin ?? false;
  const user = data?.user;
  const [clientUser, setClientUser] = useState<any>(user);
  const userSyncAttemptedRef = useRef(false);
  const effectiveUser = clientUser ?? user;
  const effectiveIsAdmin = effectiveUser ? isAdmin((effectiveUser as any).role) : isAdminFromLoader;
  const genres = data?.genres ?? [];
  const unreadCount = data?.unreadCount;
  const initialNotifications = data?.initialNotifications;
  const isBot = data?.isBot;
  const ageVerified = data?.ageVerified;
  const navigate = useNavigate();
  const location = useLocation();
  const revalidator = useRevalidator();
  const lastHomeRevalidateAtRef = useRef<number>(0);
  const lastPathnameRef = useRef<string | null>(null);

  const lastPathRef = useRef<string | null>(null);
  const lastNavFromPathRef = useRef<string | null>(null);
  const lastUserIdRef = useRef<string | null>(null);
  const firedLoginRef = useRef(false);
  const firedSignUpRef = useRef(false);

  // Đặt cờ hydration CHÍNH XÁC sau khi toàn bộ cây đã hydrate (effects chạy)
  useEffect(() => {
    try {
      (window as any).__APP_HYDRATED__ = true;
      // eslint-disable-next-line no-console
      console.debug("[client] hydration HOÀN TẤT tại", performance.now(), "ms");
    } catch {}
  }, []);

  // GA4 page_view for client-side navigations (SPA).
  useEffect(() => {
    if (!ENABLE_GA4) return;
    if (isBot) return;
    try {
      const gtag = (window as any).gtag as undefined | ((...args: any[]) => void);
      if (typeof gtag !== "function") return;

      const page_path = `${location.pathname}${location.search}${location.hash}`;
      const page_location = window.location.href;
      const page_title = document.title;

      // Optional debug: ?ga_debug=1 or localStorage.vh_ga_debug=1
      const debug_mode = (() => {
        try {
          return /(?:^|[?&])ga_debug=1(?:&|$)/.test(location.search || "") || localStorage.getItem("vh_ga_debug") === "1";
        } catch {
          return false;
        }
      })();

      // Track SPA navigation boundaries
      lastNavFromPathRef.current = lastPathRef.current;
      lastPathRef.current = page_path;

      // In SPA mode we disable the automatic page_view in the initial config
      // and manually send page_view on route changes to avoid double counting.
      gtag("event", "page_view", {
        page_path,
        page_location,
        page_title,
        ...(debug_mode ? { debug_mode: true } : {}),
      });

      // Standard GA4 web event: view_search_results
      try {
        const pathname = location.pathname || "";
        if (pathname === "/search/advanced") {
          const sp = new URLSearchParams(location.search || "");
          const q = (sp.get("q") || "").trim();
          const isApplied = sp.get("apply") === "1";
          if (q && isApplied) {
            gtag("event", "view_search_results", {
              search_term: q,
              ...(debug_mode ? { debug_mode: true } : {}),
            });
          }
        }
      } catch {}

      // Domain events: manga/chapter views (URL-based, no PII)
      try {
        const pathname = location.pathname || "";
        const isMangaDetailPage =
          /^\/truyen-hentai\/[^/]+$/.test(pathname) &&
          !pathname.startsWith("/truyen-hentai/create") &&
          !pathname.startsWith("/truyen-hentai/edit") &&
          !pathname.startsWith("/truyen-hentai/manage") &&
          !pathname.startsWith("/truyen-hentai/uploaded") &&
          !pathname.startsWith("/truyen-hentai/preview") &&
          !pathname.startsWith("/truyen-hentai/chapter/");

        const isChapterReadPage =
          /^\/truyen-hentai\/[^/]+\/[^/]+$/.test(pathname) && !pathname.startsWith("/truyen-hentai/chapter/");

        if (isMangaDetailPage) {
          const slug = pathname.split("/")[2] || "";
          if (slug) {
            gtag("event", "view_item", {
              items: [
                {
                  item_id: slug,
                  item_name: slug,
                  item_category: "manga",
                },
              ],
              ...(debug_mode ? { debug_mode: true } : {}),
            });
          }
        } else if (isChapterReadPage) {
          const parts = pathname.split("/");
          const mangaSlug = parts[2] || "";
          const chapterSlug = parts[3] || "";
          if (mangaSlug && chapterSlug) {
            gtag("event", "view_item", {
              items: [
                {
                  item_id: mangaSlug,
                  item_name: mangaSlug,
                  item_category: "manga",
                  item_variant: chapterSlug,
                },
              ],
              ...(debug_mode ? { debug_mode: true } : {}),
            });
            // Custom event for easier analysis (can be marked as a conversion if needed)
            gtag("event", "read_chapter", {
              manga_slug: mangaSlug,
              chapter_slug: chapterSlug,
              ...(debug_mode ? { debug_mode: true } : {}),
            });
          }
        }
      } catch {}

      // Heuristic: sign_up completion (register redirects to /login?registerSuccess=true)
      try {
        if (!firedSignUpRef.current && location.pathname === "/login") {
          const sp = new URLSearchParams(location.search || "");
          if (sp.get("registerSuccess") === "true") {
            firedSignUpRef.current = true;
            gtag("event", "sign_up", {
              method: "email",
              ...(debug_mode ? { debug_mode: true } : {}),
            });
          }
        }
      } catch {}
    } catch {}
  }, [location.pathname, location.search, location.hash, isBot]);

  // GA4 identity enrichment (non-PII): user_id + user properties
  useEffect(() => {
    if (!ENABLE_GA4) return;
    if (isBot) return;
    try {
      const gtag = (window as any).gtag as undefined | ((...args: any[]) => void);
      if (typeof gtag !== "function") return;

      const userId = effectiveUser && (effectiveUser as any).id != null ? String((effectiveUser as any).id) : null;
      const role = effectiveUser && (effectiveUser as any).role != null ? String((effectiveUser as any).role) : undefined;

      if (userId) {
        gtag("set", { user_id: userId });
        gtag("set", "user_properties", {
          is_admin: effectiveIsAdmin ? 1 : 0,
          user_role: role,
        });

        // Heuristic: successful login (user becomes available after navigating from /login)
        if (!lastUserIdRef.current && lastNavFromPathRef.current?.startsWith("/login") && !firedLoginRef.current) {
          firedLoginRef.current = true;
          gtag("event", "login", { method: "password" });
        }
      } else {
        // Best-effort reset (gtag doesn't guarantee clearing user_id, but this prevents our own re-use)
        gtag("set", { user_id: undefined });
        gtag("set", "user_properties", {
          is_admin: 0,
        });
      }

      lastUserIdRef.current = userId;
    } catch {}
  }, [effectiveUser, effectiveIsAdmin, isBot]);

  // ✅ Quy ước hiển thị
  const isHome = location.pathname === "/";
  const isSummon = location.pathname.startsWith("/waifu/summon");
  const isChapter = location.pathname.includes("/chapter/");

  // 18+ warning overlay should only appear on pillar entry pages.
  const normalizedPath = (location.pathname.replace(/\/+$/, "") || "/") as string;
  const isAdultWarningPillar =
    normalizedPath === "/gioi-thieu" ||
    normalizedPath === "/truyen-hentai" ||
    normalizedPath === "/genres";

  // Banner chỉ hiện ở trang chủ
  const hideBanner = !isHome;
  // Footer giờ chỉ hiển thị tại trang chủ
  const hideFooter = !isHome;

  useEffect(() => {
    if (user && user !== clientUser) {
      setClientUser(user);
    }
  }, [user, clientUser]);

  useEffect(() => {
    if (!effectiveUser) return;

    const checkUserBanStatus = async () => {
      try {
        const response = await fetch("/api/user-status", {
          headers: { Accept: "application/json" },
        });
        const data = await response.json();
        if (data?.success && data?.data?.isBanned) {
          navigate("/logout");
        }
        // Sync blacklist tags to localStorage for client components (e.g., MangaCard)
        try {
          const list = (data?.data?.blacklistTags || []) as string[];
          if (Array.isArray(list)) {
            localStorage.setItem("vh_blacklist_tags", JSON.stringify(list));
          }
        } catch {}
      } catch (error) {
        console.error("Error checking user ban status:", error);
      }
    };

    const shouldCheckNow = () => {
      const lastCheck = localStorage.getItem(LAST_BAN_CHECK_KEY);
      if (!lastCheck) return true;
      const diff = Date.now() - parseInt(lastCheck, 10);
      return diff >= BAN_CHECK_INTERVAL_MS;
    };

    const performBanCheck = () => {
      if (shouldCheckNow()) {
        localStorage.setItem(LAST_BAN_CHECK_KEY, Date.now().toString());
        checkUserBanStatus();
      }
    };

    performBanCheck();
    const id = setInterval(performBanCheck, BAN_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [effectiveUser, navigate]);

  // If UI shows guest but session exists, try to refresh user once on client
  useEffect(() => {
    if (effectiveUser) return;
    if (isBot) return;
    if (userSyncAttemptedRef.current) return;
    userSyncAttemptedRef.current = true;

    let canceled = false;
    const syncUser = async () => {
      try {
        const response = await fetch("/api/user", { headers: { Accept: "application/json" } });
        const data = await response.json();
        if (!canceled && data?.success && data?.data) {
          setClientUser(data.data);
          revalidator.revalidate();
        }
      } catch {}
    };

    syncUser();
    return () => {
      canceled = true;
    };
  }, [effectiveUser, isBot, revalidator]);

  // Force revalidate when navigating back to home (SPA cache can show stale guest state)
  useEffect(() => {
    const nextPath = location.pathname;
    const prevPath = lastPathnameRef.current;
    lastPathnameRef.current = nextPath;

    if (nextPath === "/" && prevPath && prevPath !== "/" && revalidator.state === "idle") {
      const now = Date.now();
      if (now - lastHomeRevalidateAtRef.current > 3000) {
        lastHomeRevalidateAtRef.current = now;
        revalidator.revalidate();
      }
    }
  }, [location.pathname, revalidator]);

  // Revalidate root loader when page is restored from bfcache
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        revalidator.revalidate();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        revalidator.revalidate();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [revalidator]);

  // Fallback vá lỗi: nếu click vào link nội bộ mà SPA không điều hướng, ép điều hướng full page
  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      try {
        if (ev.defaultPrevented) return;
        if (ev.button !== 0) return; // chỉ chuột trái
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return; // có phím bổ trợ thì bỏ

        const target = ev.target as Element | null;
        if (!target || typeof (target as any).closest !== "function") return;
        const anchor = (target as Element).closest("a[href]") as HTMLAnchorElement | null;
        if (!anchor) return;
        if (anchor.hasAttribute("download")) return;
        const tgt = anchor.getAttribute("target");
        if (tgt && tgt.toLowerCase() !== "_self") return; // mở tab khác thì bỏ

        const hrefAttr = anchor.getAttribute("href");
        if (!hrefAttr) return;
        let url: URL;
        try {
          url = new URL(hrefAttr, window.location.origin);
        } catch {
          return;
        }
        // Chỉ xử lý link nội bộ
        if (url.origin !== window.location.origin) return;

        const before = window.location.pathname + window.location.search + window.location.hash;
        const next = url.pathname + url.search + url.hash;
        if (next === before) return; // link tới chính trang hiện tại — không cần ép

        // Sau 1 microtask, nếu router không đổi URL thì ép điều hướng
        queueMicrotask(() => {
          const after = window.location.pathname + window.location.search + window.location.hash;
          if (after === before) {
            window.location.assign(url.toString());
          }
        });
      } catch {
        /* ignore */
      }
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  return (
      <NotificationsProvider
        key={effectiveUser ? effectiveUser.id : "guest"}
        initialUnreadCount={typeof unreadCount === "number" ? unreadCount : 0}
        initialNotifications={initialNotifications}
      >
      <DialogWarningAdultContent
        enabled={isAdultWarningPillar}
        defaultOpen={isAdultWarningPillar && !ageVerified}
        disabled={Boolean(ageVerified)}
      />
      <Header
        isAdmin={effectiveIsAdmin}
        user={effectiveUser}
        genres={genres}
        hideBanner={hideBanner}
        disableAutoHide={isSummon}
        isFixed={!isSummon}
        autoPrefetchNotifications={false}
      />
      <Outlet />
      {!hideFooter && <Footer />}
    </NotificationsProvider>
  );
}

export function ErrorBoundary() {
  return <CustomErrorBoundary />;
}
