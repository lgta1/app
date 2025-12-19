import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

export async function loader({ params }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) {
    throw new Response("Not Found", { status: 404 });
  }
  return redirect(`/authors/${slug}`, { status: 301 });
}
