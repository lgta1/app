import { type LoaderFunctionArgs, Outlet, redirect } from "react-router";

import { requireAdminOrModLogin } from "@/services/auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdminOrModLogin(request);

  const url = new URL(request.url);

  if (url.pathname === "/admin/statistic") {
    return redirect("/admin/statistic/manga");
  }
};

export default function Layout() {
  return <Outlet />;
}
