import { requireLogin } from "@/services/auth.server";

import type { Route } from "./+types/api.files.list";

import { listPublicFiles } from "~/utils/minio.utils";

export async function loader({ request }: Route.LoaderArgs) {
  try {
    // Kiểm tra authentication - required user login
    await requireLogin(request);

    const url = new URL(request.url);
    const prefixPath = url.searchParams.get("prefixPath") || "";
    const limit = Number(url.searchParams.get("limit")) || 100;
    const recursive = url.searchParams.get("recursive") === "true";

    // List files from default bucket
    const files = await listPublicFiles({
      prefixPath,
      recursive,
      maxKeys: limit,
    });

    return Response.json({
      success: true,
      data: files.map((file) => ({
        ...file,
        isPublic: true, // Indicate these are public URLs
      })),
      message: "Lấy danh sách file thành công",
      meta: {
        prefixPath,
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
        error: "Lấy danh sách file thất bại",
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
