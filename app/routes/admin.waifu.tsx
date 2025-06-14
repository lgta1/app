import {
  type LoaderFunctionArgs,
  type MetaFunction,
  Outlet,
  redirect,
} from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Quản lý Waifu | Admin" },
    { name: "description", content: "Trang quản lý hệ thống Waifu" },
  ];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.pathname === "/admin/waifu") {
    return redirect("/admin/waifu/banner");
  }
};

export default function Layout() {
  return <Outlet />;
}
