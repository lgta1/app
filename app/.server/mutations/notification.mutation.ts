import {
  NotificationModel,
  type NotificationType,
} from "~/database/models/notification.model";
import { pruneNotificationsForUser, MAX_NOTIFICATIONS_PER_USER } from "~/.server/queries/notification.query";

export const readNotifications = async (notificationIds: string[]) => {
  try {
    await NotificationModel.updateMany(
      { _id: { $in: notificationIds } },
      { isRead: true },
    );

    return {
      success: true,
      message: "Đọc thông báo thành công",
    };
  } catch (error) {
    return {
      success: false,
      message: "Lỗi khi đọc thông báo",
    };
  }
};

export const deleteNotification = async (notificationId: string) => {
  try {
    await NotificationModel.deleteOne({ _id: notificationId });

    return {
      success: true,
      message: "Xóa thông báo thành công",
    };
  } catch (error) {
    return {
      success: false,
      message: "Lỗi khi xóa thông báo",
    };
  }
};

export const createNotification = async (notification: Partial<NotificationType>) => {
  try {
    const created = await NotificationModel.create(notification);
    const userId = created?.userId || notification.userId;
    if (userId) {
      await pruneNotificationsForUser(userId, MAX_NOTIFICATIONS_PER_USER);
    }

    return {
      success: true,
      message: "Tạo thông báo thành công",
    };
  } catch (error) {
    return {
      success: false,
      message: "Lỗi khi tạo thông báo",
    };
  }
};
