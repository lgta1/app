import type { Route } from "./+types/api.files.list";

import { requireLogin } from "~/helpers/auth.server";
import { listFiles } from "~/utils/minio.utils";

export async function loader({ request }: Route.LoaderArgs) {
  try {
    // Kiểm tra authentication - required user login
    await requireLogin(request);

    const url = new URL(request.url);
    const bucket = url.searchParams.get("bucket") || "uploads";
    const prefix = url.searchParams.get("prefix") || "";
    const limit = Number(url.searchParams.get("limit")) || 100;
    const recursive = url.searchParams.get("recursive") === "true";

    const files = await listFiles({
      bucket,
      prefix,
      recursive,
      maxKeys: limit,
    });

    return Response.json({
      success: true,
      data: files,
      message: "Files retrieved successfully",
      meta: {
        bucket,
        prefix,
        count: files.length,
        limit,
      },
    });
  } catch (error) {
    console.error("List files error:", error);

    // Handle redirect errors (authentication)
    if (error instanceof Response) {
      throw error;
    }

    return Response.json(
      {
        success: false,
        error: "Failed to list files",
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
