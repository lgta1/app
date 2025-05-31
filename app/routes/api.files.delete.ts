import { getUserId } from "@/services/session.svc";

import type { Route } from "./+types/api.files.delete";

import { deleteFile, deleteFiles } from "~/utils/minio.utils";

export async function action({ request }: Route.ActionArgs) {
  try {
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

    const formData = await request.formData();
    const objectName = formData.get("objectName") as string;
    const objectNames = formData.get("objectNames") as string;
    const bucket = (formData.get("bucket") as string) || "uploads";

    // Validate input
    if (!objectName && !objectNames) {
      return Response.json(
        {
          success: false,
          error: "Either objectName or objectNames must be provided",
        },
        { status: 400 },
      );
    }

    if (objectName && objectNames) {
      return Response.json(
        {
          success: false,
          error: "Cannot provide both objectName and objectNames",
        },
        { status: 400 },
      );
    }

    let deletedCount = 0;
    let deletedItems: string[] = [];

    if (objectName) {
      // Delete single file
      await deleteFile(objectName, { bucket });
      deletedCount = 1;
      deletedItems = [objectName];
    } else if (objectNames) {
      // Delete multiple files
      const namesArray = JSON.parse(objectNames) as string[];

      if (!Array.isArray(namesArray) || namesArray.length === 0) {
        return Response.json(
          {
            success: false,
            error: "objectNames must be a non-empty array",
          },
          { status: 400 },
        );
      }

      // Limit batch delete to 100 items for performance
      if (namesArray.length > 100) {
        return Response.json(
          {
            success: false,
            error: "Cannot delete more than 100 files at once",
          },
          { status: 400 },
        );
      }

      await deleteFiles(namesArray, { bucket });
      deletedCount = namesArray.length;
      deletedItems = namesArray;
    }

    return Response.json({
      success: true,
      data: {
        deletedCount,
        deletedItems,
        bucket,
      },
      message: `Successfully deleted ${deletedCount} file(s)`,
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
        error: "Delete failed",
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
