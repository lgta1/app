import { useEffect } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation, // << ADDED
  useNavigate,
} from "react-router-dom";

import { getAllGenres } from "@/queries/genres.query";
import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/root";

import "./app.css";

import { ErrorBoundary as CustomErrorBoundary } from "~/components/error-boundary";
import { Footer } from "~/components/footer";
import { Header } from "~/components/header";
import { isAdmin } from "~/helpers/user.helper";

// C?u h�nh th?i gian check ban status (ph�t)
const BAN_CHECK_INTERVAL_MINUTES = 1;
const BAN_CHECK_INTERVAL_MS = BAN_CHECK_INTERVAL_MINUTES * 60 * 1000;
const LAST_BAN_CHECK_KEY = "lastBanCheck";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Irish+Grover&display=swap",
  },
];

// ? META m?c d?nh cho to�n site
export function meta({}: Route.MetaArgs) {
  return [
    {
      title: "Vinahentai - �?c hentai 18+ �T QU?NG C�O hot nh?t 2025",
    },
    {
      name: "description",
      content:
        "Vinahentai - Trang d?c truy?n hentai, manhwa 18+ vietsub, hentaiVN kh�ng che. �t qu?ng c�o, c?p nh?t nhanh, da d?ng th? lo?i hot nh?t 2025. Tr?i nghi?m ngay!",
    },

    // (Tu? ch?n) Open Graph / Twitter d? hi?n th? d?p khi share
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Vinahentai" },
    {
      property: "og:title",
      content: "Vinahentai - Hentai 18+ �t qu?ng c�o 2025",
    },
    {
      property: "og:description",
      content:
        "Trang d?c hentai/manhwa 18+ vietsub, c?p nh?t nhanh, �t qu?ng c�o. Tr?i nghi?m ngay!",
    },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}

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

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUserInfoFromSession(request);
  const genres = await getAllGenres();

  if (user) {
    return {
      isAdmin: isAdmin(user.role),
      user,
      genres,
    };
  }

  return {
    isAdmin: false,
    genres,
  };
}

export default function App() {
  const { isAdmin, user, genres } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const location = useLocation(); // << ADDED

  // ?n Footer n?u dang ? trang tri?u h?i (bao ph? /waifu/summon v� m?i nh�nh con)
  const hideFooter = location.pathname.startsWith("/waifu/summon"); // << ADDED

  useEffect(() => {
    // Ch? ch?y logic n�y n?u user d� dang nh?p
    if (!user) return;

    const checkUserBanStatus = async () => {
      try {
        const response = await fetch("/api/user");
        const data = await response.json();

        if (data.success && data.data && data.data.isBanned) {
          // User b? ban, th?c hi?n logout
          navigate("/logout");
        }
      } catch (error) {
        console.error("Error checking user ban status:", error);
      }
    };

    const shouldCheckNow = () => {
      const lastCheck = localStorage.getItem(LAST_BAN_CHECK_KEY);
      if (!lastCheck) return true;

      const timeSinceLastCheck = Date.now() - parseInt(lastCheck, 10);
      return timeSinceLastCheck >= BAN_CHECK_INTERVAL_MS;
    };

    const performBanCheck = () => {
      if (shouldCheckNow()) {
        localStorage.setItem(LAST_BAN_CHECK_KEY, Date.now().toString());
        checkUserBanStatus();
      }
    };

    // Check ngay l?p t?c n?u c?n
    performBanCheck();

    // Setup interval d? check d?nh k?
    const intervalId = setInterval(performBanCheck, BAN_CHECK_INTERVAL_MS);

    // Cleanup interval khi component unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [user, navigate]);

  return (
    <>
      <Header isAdmin={isAdmin} user={user} genres={genres} />
      <Outlet />
      {!hideFooter && <Footer />}
      {/* << CHANGED: ch? render Footer khi kh�ng ? summon */}
    </>
  );
}

export function ErrorBoundary() {
  return <CustomErrorBoundary />;
}
