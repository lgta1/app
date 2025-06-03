import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/api.files.download";

import { downloadFile, getPublicFileInfo, getPublicFileUrl } from "~/utils/minio.utils";

export async function loader({ request }: Route.LoaderArgs) {
  try {
    // Kiểm tra authentication - required user login
    const userInfo = await getUserInfoFromSession(request);

    if (!userInfo) {
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
    const bucket = url.searchParams.get("bucket") || "public-uploads";
    const download = url.searchParams.get("download") === "true";

    if (!objectName) {
      return Response.json(
        {
          success: false,
          error: "objectName parameter is required",
        },
        { status: 400 },
      );
    }

    if (download) {
      // Direct download - stream the file
      const fileStream = await downloadFile(objectName, { bucket });
      const fileInfo = await getPublicFileInfo(objectName, bucket);

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
                "Cache-Control": "public, max-age=86400", // Public cache for 1 day
              },
            }),
          );
        });
        fileStream.on("error", reject);
      });
    } else {
      // Return direct public URL (no expiration needed)
      const downloadUrl = getPublicFileUrl(objectName, bucket);
      const fileInfo = await getPublicFileInfo(objectName, bucket);

      return Response.json({
        success: true,
        data: {
          downloadUrl, // Direct public URL
          objectName,
          bucket,
          isPublic: true,
          fileInfo: {
            name: fileInfo.name,
            size: fileInfo.size,
            contentType: fileInfo.contentType,
            lastModified: fileInfo.lastModified,
            url: fileInfo.url, // Also direct public URL
          },
        },
        message: "Public download URL generated successfully",
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
