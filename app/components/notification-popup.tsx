import * as Popover from "@radix-ui/react-popover";
import { RefreshCw, X } from "lucide-react";

import type { NotificationType } from "~/database/models/notification.model";
import { formatDistanceToNow } from "~/utils/date.utils";

interface NotificationPopupProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  notifications: NotificationType[];
  isLoading: boolean;
  onDeleteNotification: (notificationId: string) => void;
  onRefresh: () => void;
}

export function NotificationPopup({
  isOpen,
  onOpenChange,
  children,
  notifications,
  isLoading,
  onDeleteNotification,
  onRefresh,
}: NotificationPopupProps) {
  return (
    <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="outline-bd-default bg-bgc-layer1 z-50 w-96 overflow-hidden rounded-lg shadow-[0px_4px_24.200000762939453px_0px_rgba(43,37,75,1.00)] outline-1 outline-offset-[-1px] sm:w-80 md:w-96 lg:w-96"
          sideOffset={16}
          align="end"
          side="bottom"
          alignOffset={-56}
        >
          {/* Header */}
          <div className="bg-bgc-layer1 flex items-center justify-between p-3">
            <div className="text-txt-primary font-sans text-base leading-normal font-semibold">
              Thông báo
            </div>
            <div className="flex items-center gap-3">
              <div
                className="text-txt-focus flex cursor-pointer items-center gap-1 font-sans text-sm leading-tight font-medium hover:opacity-80"
                onClick={onRefresh}
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
                Làm mới
              </div>
              <div className="text-txt-focus cursor-pointer font-sans text-sm leading-tight font-medium hover:opacity-80">
                Xem tất cả
              </div>
            </div>
          </div>

          {/* Notification List */}
          <div className="flex flex-col overflow-hidden">
            {isLoading ? (
              <div className="text-txt-secondary p-4 text-center">Đang tải...</div>
            ) : notifications.length === 0 ? (
              <div className="text-txt-secondary p-4 text-center">
                Không có thông báo nào
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="bg-bgc-layer1 hover:bg-bgc-layer2 flex cursor-pointer items-center justify-between p-3 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* Status Indicator */}
                    <div
                      className={`h-2 w-2 rounded-full ${
                        !notification.isRead ? "bg-success-success" : "bg-txt-secondary"
                      }`}
                    />

                    {/* Content */}
                    <div className="flex items-center gap-2.5">
                      <img
                        className="h-8 w-8 rounded"
                        src={notification.imgUrl}
                        alt="Avatar"
                      />
                      <div className="flex flex-col items-start justify-center gap-1">
                        <div className="w-48 sm:w-48 md:w-60 lg:w-64">
                          {notification.subtitle ? (
                            <>
                              <span className="text-txt-primary font-sans text-sm leading-tight font-medium">
                                {notification.title}{" "}
                              </span>
                              <span className="text-txt-secondary font-sans text-sm leading-tight font-medium">
                                {notification.subtitle}
                              </span>
                            </>
                          ) : (
                            <span className="text-txt-primary font-sans text-sm leading-tight font-medium">
                              {notification.title}
                            </span>
                          )}
                        </div>
                        <div className="text-txt-focus w-64 font-sans text-xs leading-none font-medium sm:w-48 md:w-60 lg:w-64">
                          {notification.createdAt &&
                            formatDistanceToNow(notification.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Close/Remove Icon */}
                  <div
                    className="relative h-3.5 w-3.5 cursor-pointer overflow-hidden"
                    onClick={() => onDeleteNotification(notification.id)}
                  >
                    <X className="text-txt-secondary hover:text-txt-primary absolute top-[0.75px] left-[0.75px] h-3 w-3 transition-colors" />
                  </div>
                </div>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
