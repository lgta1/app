import { type LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import { requireLogin } from "@/services/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userSession = await requireLogin(request);
  throw redirect(`/profile/${userSession.id}`);
}

export default function Profile() {
  return null;
}

