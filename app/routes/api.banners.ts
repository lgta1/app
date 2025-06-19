import type { LoaderFunctionArgs } from "react-router";

import { getAllOpenedBanners } from "~/.server/queries/banner.query";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const type = searchParams.get("type");

    if (type === "opened") {
      const openedBanners = await getAllOpenedBanners();
      return Response.json({ success: true, data: openedBanners });
    }

    return Response.json(
      { success: false, message: "Invalid type parameter" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error fetching banners:", error);
    return Response.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
