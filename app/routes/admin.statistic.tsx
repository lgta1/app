import {
  type LoaderFunctionArgs,
  type MetaFunction,
  Outlet,
  redirect,
} from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Thống kê | Admin" },
    { name: "description", content: "Trang thống kê hệ thống" },
  ];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.pathname === "/admin/statistic") {
    return redirect("/admin/statistic/manga");
  }
};

export default function Layout() {
  return <Outlet />;
}
