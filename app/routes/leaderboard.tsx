import { type LoaderFunctionArgs, Outlet, redirect } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.pathname === "/leaderboard") {
    return redirect("/leaderboard/manga");
  }
};

export default function Layout() {
  return <Outlet />;
}
