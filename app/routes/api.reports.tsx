import { type ActionFunctionArgs } from "react-router";

import { createReport } from "@/mutations/report.mutation";
import { requireLogin } from "@/services/auth.server";
import { REPORT_TYPE } from "~/constants/report";

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Require user to be logged in
    const user = await requireLogin(request);

    if (request.method !== "POST") {
      return Response.json(
        { success: false, error: "Method not allowed" },
        { status: 405 },
      );
    }

    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create-report") {
      const reason = formData.get("reason") as string;
      const targetId = formData.get("targetId") as string;
      const targetName = formData.get("targetName") as string;
      const reportType = formData.get("reportType") as string;
      const mangaId = formData.get("mangaId") as string;

      if (!reason?.trim()) {
        return Response.json(
          { success: false, error: "Vui lòng nhập lý do báo cáo" },
          { status: 400 },
        );
      }

      if (!targetId || !targetName || !reportType) {
        return Response.json(
          { success: false, error: "Thiếu thông tin bắt buộc" },
          { status: 400 },
        );
      }

      if (!Object.values(REPORT_TYPE).includes(reportType)) {
        return Response.json(
          { success: false, error: "Loại báo cáo không hợp lệ" },
          { status: 400 },
        );
      }

      const report = await createReport({
        reporterName: user.name,
        targetName,
        reason: reason.trim(),
        reportType,
        targetId,
        mangaId: mangaId || undefined,
      });

      return Response.json({
        success: true,
        message: "Báo cáo đã được gửi thành công",
        report,
      });
    }

    return Response.json(
      { success: false, error: "Intent không hợp lệ" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error in reports API:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Có lỗi xảy ra",
      },
      { status: 500 },
    );
  }
}
