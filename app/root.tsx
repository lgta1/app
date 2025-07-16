import { useEffect } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useNavigate,
} from "react-router";

import { getAllGenres } from "@/queries/genres.query";
import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/root";

import "./app.css";

import { ErrorBoundary as CustomErrorBoundary } from "~/components/error-boundary";
import { Footer } from "~/components/footer";
import { Header } from "~/components/header";
import { isAdmin } from "~/helpers/user.helper";

// Cấu hình thời gian check ban status (phút)
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

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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

  useEffect(() => {
    // Chỉ chạy logic này nếu user đã đăng nhập
    if (!user) return;

    const checkUserBanStatus = async () => {
      try {
        const response = await fetch("/api/user");
        const data = await response.json();

        if (data.success && data.data && data.data.isBanned) {
          // User bị ban, thực hiện logout
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

    // Check ngay lập tức nếu cần
    performBanCheck();

    // Setup interval để check định kỳ
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
      <Footer />
    </>
  );
}

export function ErrorBoundary() {
  return <CustomErrorBoundary />;
}
