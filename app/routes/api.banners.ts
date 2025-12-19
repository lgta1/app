import type { LoaderFunctionArgs } from "react-router";

import { getAllOpenedBanners } from "@/queries/banner.query";
import { json } from "~/utils/json.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const type = searchParams.get("type");

    if (type === "opened") {
      const openedBanners = await getAllOpenedBanners();
      return json(
        { success: true, data: openedBanners },
        {
          headers: {
            // Banners usually change rarely; safe to cache longer
            "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
            "CDN-Cache-Control": "public, max-age=600, stale-while-revalidate=1800",
          },
        },
      );
    }

    return json(
      { success: false, message: "Invalid type parameter" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Error fetching banners:", error);
    return json(
      { success: false, message: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
