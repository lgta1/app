import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";

import type { Route } from "./+types/root";

import "./app.css";

import { ErrorBoundary as CustomErrorBoundary } from "~/components/error-boundary";
import { Footer } from "~/components/footer";
import { Header } from "~/components/header";
import { ROLES } from "~/constants/user";
import { UserModel } from "~/database/models/user.model";
import { getUserId } from "~/helpers/session.server";

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
  const userId = await getUserId(request);
  const user = await UserModel.findById(userId).select("role");

  if (userId) {
    return {
      isAuthenticated: true,
      isAdmin: [ROLES.ADMIN, ROLES.MOD].includes(user?.role || ""),
    };
  }

  return {
    isAuthenticated: false,
    isAdmin: false,
  };
}

export default function App() {
  const { isAuthenticated, isAdmin } = useLoaderData<typeof loader>();

  return (
    <>
      <Header isAuthenticated={isAuthenticated} isAdmin={isAdmin} />
      <Outlet />
      <Footer />
    </>
  );
}

export function ErrorBoundary() {
  return <CustomErrorBoundary />;
}
