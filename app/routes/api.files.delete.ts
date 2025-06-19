import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/api.files.delete";

import { deletePublicFile, deletePublicFiles } from "~/utils/minio.utils";

export async function action({ request }: Route.ActionArgs) {
  try {
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

    const formData = await request.formData();
    const objectName = formData.get("objectName") as string;
    const objectNames = formData.get("objectNames") as string;
    const bucket = (formData.get("bucket") as string) || "public-uploads";

    // Validate input
    if (!objectName && !objectNames) {
      return Response.json(
        {
          success: false,
          error: "Phải cung cấp objectName hoặc objectNames",
        },
        { status: 400 },
      );
    }

    if (objectName && objectNames) {
      return Response.json(
        {
          success: false,
          error: "Không thể cung cấp cả objectName và objectNames",
        },
        { status: 400 },
      );
    }

    let deletedCount = 0;
    let deletedItems: string[] = [];

    if (objectName) {
      // Delete single file from public bucket
      await deletePublicFile(objectName, bucket);
      deletedCount = 1;
      deletedItems = [objectName];
    } else if (objectNames) {
      // Delete multiple files from public bucket
      const namesArray = JSON.parse(objectNames) as string[];

      if (!Array.isArray(namesArray) || namesArray.length === 0) {
        return Response.json(
          {
            success: false,
            error: "objectNames phải là một mảng không rỗng",
          },
          { status: 400 },
        );
      }

      // Limit batch delete to 100 items for performance
      if (namesArray.length > 100) {
        return Response.json(
          {
            success: false,
            error: "Không thể xóa hơn 100 file cùng lúc",
          },
          { status: 400 },
        );
      }

      await deletePublicFiles(namesArray, bucket);
      deletedCount = namesArray.length;
      deletedItems = namesArray;
    }

    return Response.json({
      success: true,
      data: {
        deletedCount,
        deletedItems,
        bucket,
        isPublicBucket: true,
      },
      message: `Đã xóa thành công ${deletedCount} file từ public bucket`,
    });
  } catch (error) {
    console.error("Delete error:", error);

    // Handle redirect errors (authentication)
    if (error instanceof Response) {
      throw error;
    }

    return Response.json(
      {
        success: false,
        error: "Xóa file thất bại",
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
