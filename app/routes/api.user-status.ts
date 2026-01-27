import type { LoaderFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";
import { UserModel } from "~/database/models/user.model";

const privateShortCacheHeaders = {
  "Cache-Control": "private, max-age=20, stale-while-revalidate=60",
  Vary: "Cookie",
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);
    if (!user) {
      return Response.json(
        { success: true, data: null },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const doc = await UserModel.findById(user.id)
      .select("isBanned blacklistTags")
      .lean();

    const payload = {
      success: true,
      data: {
        isBanned: Boolean((doc as any)?.isBanned),
        blacklistTags: Array.isArray((doc as any)?.blacklistTags) ? (doc as any).blacklistTags : [],
      },
    };

    return Response.json(payload, { headers: privateShortCacheHeaders });
  } catch (error) {
    return Response.json(
      { success: false, error: "Không thể lấy trạng thái user" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
