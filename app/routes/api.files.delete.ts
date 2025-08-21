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
    const fullPath = formData.get("fullPath") as string;
    const fullPaths = formData.get("fullPaths") as string;

    // Validate input
    if (!fullPath && !fullPaths) {
      return Response.json(
        {
          success: false,
          error: "Phải cung cấp fullPath hoặc fullPaths",
        },
        { status: 400 },
      );
    }

    if (fullPath && fullPaths) {
      return Response.json(
        {
          success: false,
          error: "Không thể cung cấp cả fullPath và fullPaths",
        },
        { status: 400 },
      );
    }

    let deletedCount = 0;
    let deletedItems: string[] = [];

    if (fullPath) {
      // Delete single file
      await deletePublicFile(fullPath);
      deletedCount = 1;
      deletedItems = [fullPath];
    } else if (fullPaths) {
      // Delete multiple files
      const pathsArray = JSON.parse(fullPaths) as string[];

      if (!Array.isArray(pathsArray) || pathsArray.length === 0) {
        return Response.json(
          {
            success: false,
            error: "fullPaths phải là một mảng không rỗng",
          },
          { status: 400 },
        );
      }

      // Limit batch delete to 100 items for performance
      if (pathsArray.length > 100) {
        return Response.json(
          {
            success: false,
            error: "Không thể xóa hơn 100 file cùng lúc",
          },
          { status: 400 },
        );
      }

      await deletePublicFiles(pathsArray);
      deletedCount = pathsArray.length;
      deletedItems = pathsArray;
    }

    return Response.json({
      success: true,
      data: {
        deletedCount,
        deletedItems,
      },
      message: `Đã xóa thành công ${deletedCount} file`,
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
