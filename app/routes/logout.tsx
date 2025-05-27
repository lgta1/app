import type { MetaFunction } from "react-router";

import type { Route } from "./+types/logout";

import { logout } from "~/helpers/auth.server";

export const meta: MetaFunction = () => {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
};

export async function loader({ request }: Route.LoaderArgs) {
  return logout(request);
}
