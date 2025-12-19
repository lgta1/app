// app/.server/mutations/system-ban.direct.ts
// Ban trực tiếp tại server (Mongo/Mongoose), KHÔNG dùng request/role của caller.

import { isValidObjectId } from "mongoose";
import { ROLES } from "~/constants/user";
import { UserModel } from "~/database/models/user.model";
import { createNotification } from "@/mutations/notification.mutation";

type SystemBanArgs = {
  targetUserId: string;
  days: number;             // số ngày ban
  reason: string;           // lý do (được log vào banMessage)
  actor?: string;           // nhãn tác nhân hệ thống, ví dụ "bulk"
};

export async function systemBanDirect({
  targetUserId,
  days,
  reason,
  actor = "system",
}: SystemBanArgs) {
  if (!isValidObjectId(targetUserId)) {
    throw new Error("Invalid target user id");
  }
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error("Ban days must be > 0");
  }

  const user = await UserModel.findById(targetUserId).select("role").lean();
  if (!user) throw new Error("Target user not found");

  // Không ban admin/mod (đổi theo policy của bạn)
  const role = String(user.role || "").toUpperCase();
  if (role === ROLES.ADMIN || role === ROLES.MOD) {
    throw new Error("Refuse to ban privileged account");
  }

  const now = new Date();
  const banExpiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const banMessage = `[${actor}] ${reason}`.slice(0, 500);

  // Cập nhật trạng thái ban + cộng warningsCount
  await UserModel.findOneAndUpdate(
    { _id: targetUserId, role: { $ne: ROLES.ADMIN } },
    {
      $set: {
        isBanned: true,
        banExpiresAt,
        banMessage,
      },
      $inc: { warningsCount: 1 },
    },
    { new: false },
  );

  // Thông báo cho user (không để việc gửi noti làm hỏng lệnh ban)
  try {
    await createNotification({
      userId: targetUserId,
      title: `Bạn đã vi phạm quy định. Tài khoản sẽ bị cấm trong ${days} ngày`,
      imgUrl: "/images/noti/ban.png",
    });
  } catch (e) {
    console.warn("[systemBanDirect] notify failed:", e);
  }

  return { ok: true as const, until: banExpiresAt, message: banMessage };
}
