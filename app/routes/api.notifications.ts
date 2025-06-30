import type { Route } from "./+types/api.notifications";

import {
  deleteNotification,
  readNotifications,
} from "~/.server/mutations/notification.mutation";
import { getNewestNotifications } from "~/.server/queries/notification.query";
import { getUserInfoFromSession } from "~/.server/services/session.svc";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUserInfoFromSession(request);

  if (!user) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const notifications = await getNewestNotifications(user.id, 5);
    return Response.json({ success: true, data: notifications });
  } catch (error) {
    return Response.json(
      { success: false, message: "Lỗi khi lấy danh sách thông báo" },
      { status: 500 },
    );
  }
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getUserInfoFromSession(request);

  if (!user) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const action = formData.get("action") as string;

  if (action === "delete") {
    const notificationId = formData.get("notificationId") as string;
    if (notificationId) {
      const result = await deleteNotification(notificationId);
      return Response.json(result);
    }
  }

  if (action === "read") {
    const notificationIds = formData.get("notificationIds") as string;
    if (notificationIds) {
      const ids = JSON.parse(notificationIds);
      const result = await readNotifications(ids);
      return Response.json(result);
    }
  }

  return Response.json(
    { success: false, message: "Action không hợp lệ" },
    { status: 400 },
  );
}
