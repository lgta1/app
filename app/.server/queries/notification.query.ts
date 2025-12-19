import { NotificationModel } from "~/database/models/notification.model";

export const MAX_NOTIFICATIONS_PER_USER = 10;

const normalizeNotification = (doc: any) => ({
  ...doc,
  id: String(doc?.id ?? doc?._id ?? ""),
});

const clampLimit = (limit: number | undefined) => {
  if (!limit || Number.isNaN(limit)) return MAX_NOTIFICATIONS_PER_USER;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_NOTIFICATIONS_PER_USER);
};

export const getNewestNotifications = async (userId: string, limit = MAX_NOTIFICATIONS_PER_USER) => {
  const normalizedLimit = clampLimit(limit);
  const raw = await NotificationModel.find({ userId })
    .sort({ isRead: 1, createdAt: -1 })
    .limit(normalizedLimit)
    .lean();
  return (raw as any[]).map((d) => normalizeNotification(d));
};

export const countUnreadNotifications = async (userId: string) => {
  const total = await NotificationModel.countDocuments({ userId, isRead: false });
  return total;
};

export const pruneNotificationsForUser = async (userId: string, keep = MAX_NOTIFICATIONS_PER_USER) => {
  if (!userId) return;
  const normalizedKeep = clampLimit(keep);
  const extras = await NotificationModel.find({ userId })
    .sort({ createdAt: -1 })
    .skip(normalizedKeep)
    .select({ _id: 1 })
    .lean();

  if (!extras.length) return;

  await NotificationModel.deleteMany({ _id: { $in: extras.map((doc: any) => doc._id) } });
};

export const getNotificationsWithUnreadCount = async (userId: string, limit = MAX_NOTIFICATIONS_PER_USER) => {
  const normalizedLimit = clampLimit(limit);
  const notifications = await getNewestNotifications(userId, normalizedLimit);
  // Clean up stale rows asynchronously to keep collection small.
  void pruneNotificationsForUser(userId, MAX_NOTIFICATIONS_PER_USER).catch((err) => {
    console.error("[notifications] prune failed", err);
  });

  const totalUnreadCount = notifications.filter((item) => !item.isRead).length;
  return { notifications, totalUnreadCount };
};
