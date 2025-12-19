import { Outlet } from "react-router-dom";

// Layout shell for /genres and its children. Ensures slug routes render instead of falling back to the pillar.
export default function GenresLayout() {
  return <Outlet />;
}
