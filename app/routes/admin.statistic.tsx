import { type LoaderFunctionArgs, Outlet, redirect } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.pathname === "/admin/statistic") {
    return redirect("/admin/statistic/manga");
  }
};

export default function Layout() {
  return <Outlet />;
}
