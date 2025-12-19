import { useRef, useState, useEffect } from "react";
import { Bell } from "lucide-react";

import { NotificationPopup } from "./notification-popup";
import { useNotificationsContext } from "~/context/notifications-context";
import type { NotificationType } from "~/database/models/notification.model";

export function NotificationBell({ autoPrefetch = false }: { autoPrefetch?: boolean }) {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    isLoading,
    hasLoaded,
    error,
    loadNotifications,
    markNotificationsRead,
  } = useNotificationsContext();
  const prefetchedRef = useRef(false);

  useEffect(() => {
    if (!autoPrefetch) return;
    if (prefetchedRef.current) return;
    if (hasLoaded) return;
    prefetchedRef.current = true;
    loadNotifications({ force: true });
  }, [autoPrefetch, hasLoaded, loadNotifications]);

  const handleOpenChange = (open: boolean) => {
    setIsNotificationOpen(open);
    if (open) {
      loadNotifications();
      return;
    }

    if (!hasLoaded) return;
    const unreadIds = notifications.filter((notification) => !notification.isRead).map((notification) => notification.id);
    if (unreadIds.length > 0) {
      void markNotificationsRead(unreadIds);
    }
  };

  const handleNavigateNotification = (notification: NotificationType) => {
    setIsNotificationOpen(false);
    if (!notification.isRead) {
      void markNotificationsRead([notification.id]);
    }
  };

  const handleRetry = () => {
    loadNotifications({ force: true });
  };

  const handlePointerIntent = () => {
    loadNotifications();
  };

  return (
    <NotificationPopup
      isOpen={isNotificationOpen}
      onOpenChange={handleOpenChange}
      notifications={notifications}
      isLoading={isLoading}
      errorMessage={error}
      onNavigate={handleNavigateNotification}
      onRetry={handleRetry}
    >
      <button
        type="button"
        className="relative cursor-pointer bg-transparent outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D373FF] focus-visible:outline-offset-2"
        onPointerEnter={handlePointerIntent}
        onFocus={handlePointerIntent}
        aria-label="Thông báo"
      >
        <Bell className="text-txt-primary h-6 w-6" />
        {unreadCount > 0 && (
          <div className="text-txt-primary absolute top-[-5px] right-[-5px] rounded-lg bg-[#E03F46] px-1 py-[2px] text-[8px] font-semibold">
            {unreadCount}
          </div>
        )}
      </button>
    </NotificationPopup>
  );
}
