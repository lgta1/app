import {
  NotificationModel,
  type NotificationType,
} from "~/database/models/notification.model";

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
    await NotificationModel.create(notification);

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
