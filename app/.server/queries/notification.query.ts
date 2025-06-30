import { NotificationModel } from "~/database/models/notification.model";

export const getNewestNotifications = async (userId: string, limit = 5) => {
  const notifications = await NotificationModel.find({ userId })
    .sort({ isRead: 1, createdAt: -1 })
    .limit(limit)
    .lean();
  return notifications;
};
