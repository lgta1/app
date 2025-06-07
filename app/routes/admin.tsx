import { type LoaderFunctionArgs, type MetaFunction } from "react-router";

import { requireAdminOrModLogin } from "@/services/auth.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Admin Dashboard" },
    { name: "description", content: "Trang quản trị hệ thống" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminOrModLogin(request);
}
