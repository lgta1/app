import { Outlet } from "react-router-dom";

// Parent layout for /truyen-hentai and nested routes.
// Purpose: keep pillar (/truyen-hentai) and detail (/truyen-hentai/:slug) strictly separated.
export default function TruyenHentaiLayout() {
  return <Outlet />;
}
