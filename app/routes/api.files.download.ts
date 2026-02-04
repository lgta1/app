import { getUserInfoFromSession } from "@/services/session.svc";
import { MINIO_CONFIG } from "@/configs/minio.config";

import type { Route } from "./+types/api.files.download";

import {
  downloadFile,
  getEnvironmentPrefix,
  getPublicFileInfo,
  getPublicFileUrl,
} from "~/utils/minio.utils";
import { getCdnBase } from "~/.server/utils/cdn-url";
import { rewriteCdnHostsDeepInPlace } from "~/.server/utils/cdn-host-rewrite";

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
    const fullPath = url.searchParams.get("fullPath");
    const download = url.searchParams.get("download") === "true";

    if (!fullPath) {
      return Response.json(
        {
          success: false,
          error: "Tham số fullPath là bắt buộc",
        },
        { status: 400 },
      );
    }

    const normalizePath = (value: string) => String(value || "").replace(/^\/+/, "");
    const resolvePublicInfo = async (value: string) => {
      const raw = normalizePath(value);
      const candidates = new Set<string>();
      if (raw) candidates.add(raw);

      // Handle bucket-prefixed paths
      const bucket = MINIO_CONFIG.DEFAULT_BUCKET || "";
      if (bucket && raw.startsWith(`${bucket}/`)) {
        candidates.add(raw.slice(bucket.length + 1));
      }

      // Handle env prefix (test/)
      const envPrefix = getEnvironmentPrefix();
      if (envPrefix) {
        const withEnv = `${envPrefix}/${raw}`.replace(/^\/+/, "");
        candidates.add(withEnv);
        if (raw.startsWith(`${envPrefix}/`)) {
          candidates.add(raw.slice(envPrefix.length + 1));
        }
      }

      let lastError: unknown = null;
      for (const candidate of candidates) {
        try {
          const info = await getPublicFileInfo(candidate);
          return { info, fullPath: candidate };
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error("File not found");
    };

    if (download) {
      // Direct download - stream the file
      const resolved = await resolvePublicInfo(fullPath);
      const fileStream = await downloadFile(resolved.fullPath);
      const fileInfo = resolved.info;

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
      const resolved = await resolvePublicInfo(fullPath);
      const downloadUrl = getPublicFileUrl(resolved.fullPath);
      const fileInfo = resolved.info;

      const payload = {
        success: true,
        data: {
          downloadUrl, // Direct public URL
          fullPath: resolved.fullPath,
          isPublic: true,
          fileInfo: {
            name: fileInfo.name,
            fullPath: fileInfo.fullPath,
            size: fileInfo.size,
            contentType: fileInfo.contentType,
            lastModified: fileInfo.lastModified,
            url: fileInfo.url, // Also direct public URL
            prefixPath: fileInfo.prefixPath,
          },
        },
        message: "Tạo URL tải xuống thành công",
      };

      try {
        rewriteCdnHostsDeepInPlace(payload as any, getCdnBase(request as any));
      } catch {}

      return Response.json(payload);
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
        error: "Tải xuống thất bại",
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
