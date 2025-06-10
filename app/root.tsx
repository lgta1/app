import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/root";

import "./app.css";

import { getAllGenres } from "~/.server/queries/genres.query";
import { ErrorBoundary as CustomErrorBoundary } from "~/components/error-boundary";
import { Footer } from "~/components/footer";
import { Header } from "~/components/header";
import { isAdmin } from "~/helpers/user.helper";

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
