// app/root.tsx
import { useEffect } from "react";

// 👉 SSR primitives + data hooks lấy từ "react-router"
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";

// 👉 Client-only hooks từ "react-router-dom"
import { useLocation, useNavigate } from "react-router-dom";

import type { Route } from "./+types/root";

import { getAllGenres } from "@/queries/genres.query";
import { getUserInfoFromSession } from "@/services/session.svc";
import { ErrorBoundary as CustomErrorBoundary } from "~/components/error-boundary";
import { Footer } from "~/components/footer";
import { Header } from "~/components/header";
import { isAdmin } from "~/helpers/user.helper";

// 🔧 NẠP CSS qua links() cho SSR
import appStylesheetUrl from "./app.css?url";

// Cấu hình check "ban" định kỳ
const BAN_CHECK_INTERVAL_MINUTES = 1;
const BAN_CHECK_INTERVAL_MS = BAN_CHECK_INTERVAL_MINUTES * 60 * 1000;
const LAST_BAN_CHECK_KEY = "lastBanCheck";

// Liên kết stylesheet + fonts
export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: appStylesheetUrl },

  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href:
      "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  {
    rel: "stylesheet",
    href:
      "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Irish+Grover&display=swap",
  },
];

// META mặc định
export function meta({}: Route.MetaArgs) {
  return [
    { title: "Vinahentai -  Đọc hentai 18+ ít quảng cáo hot nhất 2025" },
    {
      name: "description",
      content:
        "Vinahentai - Trang đọc truyện hentai, manhwa 18+ vietsub, hentaiVN không che. Ít quảng cáo, cập nhật nhanh, đa dạng thể loại hot nhất 2025. Trải nghiệm ngay!",
    },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Vinahentai" },
    { property: "og:title", content: "Vinahentai - Hentai 18+ ít quảng cáo 2025" },
    {
      property: "og:description",
      content:
        "Trang đọc hentai/manhwa 18+ vietsub, cập nhật nhanh, ít quảng cáo. Trải nghiệm ngay!",
    },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}

// Layout SSR chuẩn
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Loader: lấy user + genres từ DB
export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUserInfoFromSession(request);
  const genres = await getAllGenres();

  // Log chẩn đoán
  try {
    const count = Array.isArray(genres) ? genres.length : (genres as any)?.length || 0;
    const hasBondage = Array.isArray(genres) && genres.some((g: any) => g?.slug === "bondage");
    const hasSlave = Array.isArray(genres) && genres.some((g: any) => g?.slug === "slave");
    console.log("[loader:root] genres count =", count, "| bondage:", hasBondage, "| slave:", hasSlave);
  } catch {}

  if (user) {
    return { isAdmin: isAdmin(user.role), user, genres };
  }
  return { isAdmin: false, genres };
}

// App: truyền genres vào Header để hiển thị menu thể loại
export default function App() {
  const { isAdmin, user, genres } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const location = useLocation();

  // Ẩn Footer nếu đang ở trang triệu hồi
  const hideFooter = location.pathname.startsWith("/waifu/summon");

  useEffect(() => {
    if (!user) return;

    const checkUserBanStatus = async () => {
      try {
        const response = await fetch("/api/user");
        const data = await response.json();
        if (data.success && data.data && data.data.isBanned) {
          navigate("/logout");
        }
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
  }, [user, navigate]);

  return (
    <>
      <Header isAdmin={isAdmin} user={user} genres={genres} />
      <Outlet />
      {!hideFooter && <Footer />}
    </>
  );
}

// Error boundary
export function ErrorBoundary() {
  return <CustomErrorBoundary />;
}
