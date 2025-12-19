import { redirect } from "react-router";

export function loader() {
  throw redirect("/genres/anh-cosplay");
}

export default function CosplayRedirect() {
  return null;
}
