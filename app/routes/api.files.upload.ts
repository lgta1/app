import { getUserId } from "@/services/session.svc";

import type { Route } from "./+types/api.files.upload";

import { ensureBucketExists } from "~/configs/minio.config";
import { uploadFile } from "~/utils/minio.utils";

export async function action({ request }: Route.ActionArgs) {
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

    // Check content type
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("multipart/form-data")) {
      return Response.json(
        {
          success: false,
          error: "Content-Type must be multipart/form-data",
        },
        { status: 400 },
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const bucket = (formData.get("bucket") as string) || "uploads";
    const category = (formData.get("category") as string) || "general";

    // Validate file
    if (!file || file.size === 0) {
      return Response.json(
        {
          success: false,
          error: "No file provided",
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
          error: `File too large. Max size: ${maxSize / 1024 / 1024}MB`,
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
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      return Response.json(
        {
          success: false,
          error: "File type not allowed",
        },
        { status: 400 },
      );
    }

    // Ensure bucket exists
    await ensureBucketExists(bucket);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload with metadata including userId
    const result = await uploadFile(buffer, file.name, {
      bucket,
      generateUniqueFileName: true,
      contentType: file.type,
      metadata: {
        "original-name": file.name,
        "upload-date": new Date().toISOString(),
        "uploaded-by": userId,
        category: category,
        size: file.size.toString(),
        "user-agent": request.headers.get("user-agent") || "unknown",
      },
    });

    return Response.json({
      success: true,
      data: {
        objectName: result.objectName,
        url: result.url,
        bucket: result.bucket,
        size: file.size,
        type: file.type,
        originalName: file.name,
      },
      message: "File uploaded successfully",
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
        error: "Upload failed",
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
