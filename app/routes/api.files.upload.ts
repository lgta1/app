import { ensurePublicBucketExists } from "@/configs/minio.config";
import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/api.files.upload";

import { uploadToPublicBucket } from "~/utils/minio.utils";

export async function action({ request }: Route.ActionArgs) {
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

    // Check content type
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("multipart/form-data")) {
      return Response.json(
        {
          success: false,
          error: "Content-Type phải là multipart/form-data",
        },
        { status: 400 },
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const bucket = (formData.get("bucket") as string) || "public-uploads";
    const category = (formData.get("category") as string) || "general";

    // Validate file
    if (!file || file.size === 0) {
      return Response.json(
        {
          success: false,
          error: "Không có file được cung cấp",
        },
        { status: 400 },
      );
    }

    // File size limit (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return Response.json(
        {
          success: false,
          error: `File quá lớn. Kích thước tối đa: ${maxSize / 1024 / 1024}MB`,
        },
        { status: 400 },
      );
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "video/mp4",
      "video/webm",
      "audio/mpeg",
      "audio/wav",
    ];

    if (!allowedTypes.includes(file.type)) {
      return Response.json(
        {
          success: false,
          error: "Loại file không được phép",
        },
        { status: 400 },
      );
    }

    // Ensure public bucket exists
    await ensurePublicBucketExists(bucket);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to public bucket with metadata including userId
    const result = await uploadToPublicBucket(buffer, file.name, {
      bucket,
      generateUniqueFileName: true,
      contentType: file.type,
      metadata: {
        "original-name": file.name,
        "upload-date": new Date().toISOString(),
        "uploaded-by": userInfo.id,
        category: category,
        size: file.size.toString(),
        "user-agent": request.headers.get("user-agent") || "unknown",
      },
    });

    return Response.json({
      success: true,
      data: {
        objectName: result.objectName,
        url: result.url, // Direct public URL
        bucket: result.bucket,
        size: file.size,
        type: file.type,
        originalName: file.name,
        isPublic: true,
      },
      message: "Tải file lên public bucket thành công",
    });
  } catch (error) {
    console.error("Upload error:", error);

    // Handle redirect errors (authentication)
    if (error instanceof Response) {
      throw error;
    }

    return Response.json(
      {
        success: false,
        error: "Tải file lên thất bại",
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
