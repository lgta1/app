import type { Route } from "./+types/api.files.download";

import { getUserId } from "~/helpers/session.server";
import { downloadFile, getFileInfo, getFileUrl } from "~/utils/minio.utils";

export async function loader({ request }: Route.LoaderArgs) {
  try {
    // Kiểm tra authentication - required user login
    const userId = await getUserId(request);
    if (!userId) {
      return Response.json(
        {
          success: false,
          error: "Bạn cần đăng nhập để thực hiện hành động này",
        },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const objectName = url.searchParams.get("objectName");
    const bucket = url.searchParams.get("bucket") || "uploads";
    const download = url.searchParams.get("download") === "true";
    const expires = Number(url.searchParams.get("expires")) || 7 * 24 * 60 * 60; // 7 days default

    if (!objectName) {
      return Response.json(
        {
          success: false,
          error: "objectName parameter is required",
        },
        { status: 400 },
      );
    }

    // Validate expires parameter (max 7 days)
    const maxExpires = 7 * 24 * 60 * 60;
    if (expires > maxExpires) {
      return Response.json(
        {
          success: false,
          error: `expires cannot exceed ${maxExpires} seconds (7 days)`,
        },
        { status: 400 },
      );
    }

    if (download) {
      // Direct download - stream the file
      const fileStream = await downloadFile(objectName, { bucket });
      const fileInfo = await getFileInfo(objectName, { bucket });

      // Convert stream to response
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        fileStream.on("data", (chunk) => chunks.push(chunk));
        fileStream.on("end", () => {
          const buffer = Buffer.concat(chunks);

          resolve(
            new Response(buffer, {
              headers: {
                "Content-Type": fileInfo.contentType || "application/octet-stream",
                "Content-Length": fileInfo.size.toString(),
                "Content-Disposition": `attachment; filename="${fileInfo.name}"`,
                "Cache-Control": "private, max-age=3600",
              },
            }),
          );
        });
        fileStream.on("error", reject);
      });
    } else {
      // Return presigned URL for download
      const downloadUrl = await getFileUrl(objectName, { bucket, expires });
      const fileInfo = await getFileInfo(objectName, { bucket });

      return Response.json({
        success: true,
        data: {
          downloadUrl,
          objectName,
          bucket,
          expires,
          fileInfo: {
            name: fileInfo.name,
            size: fileInfo.size,
            contentType: fileInfo.contentType,
            lastModified: fileInfo.lastModified,
          },
        },
        message: "Download URL generated successfully",
      });
    }
  } catch (error) {
    console.error("Download error:", error);

    // Handle redirect errors (authentication)
    if (error instanceof Response) {
      throw error;
    }

    return Response.json(
      {
        success: false,
        error: "Download failed",
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
