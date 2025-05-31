import type { MetaFunction } from "react-router";

import { logout } from "@/services/auth.server";

import type { Route } from "./+types/logout";

export const meta: MetaFunction = () => {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
};

export async function loader({ request }: Route.LoaderArgs) {
  return logout(request);
}
