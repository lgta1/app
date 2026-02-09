import { Form, Link, useActionData, useNavigation } from "react-router-dom";
import type { ActionFunctionArgs, MetaFunction } from "react-router";

import { requireAdminLogin } from "~/.server/services/auth.server";
import { UserModel } from "~/database/models/user.model";
import { ROLES } from "~/constants/user";
import { AdminActionLogModel } from "~/database/models/admin-action-log.model";

type ActionResult = {
  ok: boolean;
  message: string;
};

export const meta: MetaFunction = () => {
  return [
    { title: "Quyền tắt watermark | Admin" },
    { name: "description", content: "Bật/tắt quyền bỏ qua watermark cho dịch giả" },
  ];
};

export async function action({ request }: ActionFunctionArgs) {
  const admin = await requireAdminLogin(request);
  const form = await request.formData();
  const userId = form.get("userId");
  const canSkipWatermark = form.get("canSkipWatermark") === "on";

  if (!userId || typeof userId !== "string") {
    return Response.json({ ok: false, message: "userId không hợp lệ" }, { status: 400 });
  }

  const user = await UserModel.findById(userId).select("role isDeleted");
  if (!user || user.isDeleted) {
    return Response.json({ ok: false, message: "User không tồn tại" }, { status: 404 });
  }

  if (user.role === ROLES.ADMIN || user.role === ROLES.MOD) {
    return Response.json({ ok: false, message: "Không thể cấp quyền cho quản trị" }, { status: 400 });
  }

  if (user.role !== ROLES.DICHGIA) {
    return Response.json({ ok: false, message: "User chưa là dịch giả. Hãy gán vai trò dịch giả trước." }, { status: 400 });
  }

  await UserModel.findByIdAndUpdate(userId, { $set: { canSkipWatermark } });

  try {
    await AdminActionLogModel.create({
      action: "SET_DICHGIA_SKIP_WATERMARK",
      adminId: admin.id,
      targetUserId: String(userId),
    } as any);
  } catch (e) {
    console.warn("[skip-watermark] log failed", e);
  }

  const message = canSkipWatermark
    ? "Đã cấp quyền bỏ qua watermark"
    : "Đã tắt quyền bỏ qua watermark";
  return Response.json({ ok: true, message });
}

export default function AdminSkipWatermark() {
  const actionData = useActionData<ActionResult>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-txt-primary">Quyền tắt watermark</h1>
        <p className="text-sm text-txt-secondary">Chỉ áp dụng cho user đã được gán vai trò dịch giả.</p>
      </div>

      {actionData?.message && (
        <div
          className={`mb-4 rounded border px-3 py-2 text-sm ${
            actionData.ok
              ? "border-[#25EBAC]/40 bg-[#25EBAC]/10 text-[#25EBAC]"
              : "border-[#FF555D]/40 bg-[#FF555D]/10 text-[#FF555D]"
          }`}
        >
          {actionData.message}
        </div>
      )}

      <Form method="post" className="space-y-4 rounded-xl border border-bd-default bg-bgc-layer1 p-6 shadow">
        <div className="space-y-2">
          <label htmlFor="userId" className="text-sm font-semibold text-txt-primary">User ID</label>
          <input
            id="userId"
            name="userId"
            required
            className="w-full rounded-lg border border-bd-default bg-bgc-layer2 px-3 py-2 text-sm text-txt-primary"
            placeholder="Nhập ID user"
          />
          <p className="text-xs text-txt-secondary">
            Nếu user chưa là dịch giả, hãy gán vai trò tại trang
            {" "}
            <Link to="/admin/roles/set-dichgia" className="text-txt-primary underline">
              Gán dịch giả
            </Link>.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-txt-primary">
          <input type="checkbox" name="canSkipWatermark" className="h-4 w-4" />
          Cho phép bỏ qua watermark khi upload chapter
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-gradient-to-r from-[#C466FF] via-[#924DBF] to-[#C466FF] px-4 py-2 text-sm font-semibold text-black shadow disabled:opacity-60"
        >
          {isSubmitting ? "Đang lưu..." : "Cập nhật"}
        </button>
      </Form>
    </div>
  );
}
