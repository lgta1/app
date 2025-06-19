import { type LoaderFunctionArgs, redirect } from "react-router";

import { getAllOpenedBanners } from "@/queries/banner.query";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  if (url.pathname === "/waifu/summon") {
    const openedBanners = await getAllOpenedBanners();
    if (openedBanners.length === 0) {
      return redirect("/");
    }

    return redirect(`/waifu/summon/${openedBanners[0].id}`);
  }
}
