// Rating feature removed. Keep route responding 410 Gone to avoid broken callers.
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

export async function loader({}: LoaderFunctionArgs) {
  return new Response("Manga rating has been removed", { status: 410 });
}

export async function action({}: ActionFunctionArgs) {
  return new Response("Manga rating has been removed", { status: 410 });
}
