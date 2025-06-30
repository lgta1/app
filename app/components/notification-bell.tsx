import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { Bell } from "lucide-react";

import { NotificationPopup } from "./notification-popup";

import type { NotificationType } from "~/database/models/notification.model";

export function NotificationBell() {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetcher = useFetcher<{ success: boolean; data: NotificationType[] }>();
  const deleteFetcher = useFetcher();
  const readFetcher = useFetcher();

  // Fetch notifications khi component mount
  useEffect(() => {
    fetcher.load("/api/notifications");
  }, []);

  // Tính số lượng thông báo chưa đọc
  useEffect(() => {
    if (fetcher.data?.data) {
      const unreadCount = fetcher.data.data.filter(
        (notification) => !notification.isRead,
      ).length;
      setUnreadCount(unreadCount);
    }
  }, [fetcher.data]);

  const handleDeleteNotification = (notificationId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa thông báo này không?")) {
      deleteFetcher.submit(
        { action: "delete", notificationId },
        { method: "post", action: "/api/notifications" },
      );
    }
  };

  // Refresh lại danh sách sau khi delete thành công
  useEffect(() => {
    if (deleteFetcher.data?.success) {
      fetcher.load("/api/notifications");
    }
  }, [deleteFetcher.data]);

  // Hàm refresh dữ liệu
  const handleRefresh = () => {
    fetcher.load("/api/notifications");
  };

  // Xử lý khi mở popup
  const handleOpenChange = (open: boolean) => {
    setIsNotificationOpen(open);

    if (!open && fetcher.data?.data) {
      // Lấy danh sách ID của các notification chưa đọc
      const unreadNotificationIds = fetcher.data.data
        .filter((notification) => !notification.isRead)
        .map((notification) => notification.id);

      // Nếu có notification chưa đọc thì gọi API để đánh dấu đã đọc
      if (unreadNotificationIds.length > 0) {
        readFetcher.submit(
          {
            action: "read",
            notificationIds: JSON.stringify(unreadNotificationIds),
          },
          { method: "post", action: "/api/notifications" },
        );
      }
    }
  };

  const notifications = fetcher.data?.data || [];
  const isLoading = fetcher.state === "loading";

  return (
    <NotificationPopup
      isOpen={isNotificationOpen}
      onOpenChange={handleOpenChange}
      notifications={notifications}
      isLoading={isLoading}
      onDeleteNotification={handleDeleteNotification}
      onRefresh={handleRefresh}
    >
      <div className="relative cursor-pointer">
        <Bell className="text-txt-primary h-6 w-6" />
        {unreadCount > 0 && (
          <div className="text-txt-primary absolute top-[-5px] right-[-5px] rounded-lg bg-[#E03F46] px-1 py-[2px] text-[8px] font-semibold">
            {unreadCount}
          </div>
        )}
      </div>
    </NotificationPopup>
  );
}
