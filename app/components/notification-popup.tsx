import * as Popover from "@radix-ui/react-popover";
import { ArrowUpRight } from "lucide-react";

import { LoadingSpinner } from "~/components/loading-spinner";
import type { NotificationType } from "~/database/models/notification.model";
import { buildMangaUrl } from "~/utils/manga-url.utils";
import { formatDistanceToNow } from "~/utils/date.utils";

interface NotificationPopupProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  notifications: NotificationType[];
  isLoading: boolean;
  errorMessage?: string | null;
  onNavigate: (notification: NotificationType) => void;
  onRetry: () => void;
}

const resolveTargetUrl = (notification: NotificationType): string | null => {
  if (notification.targetUrl) return notification.targetUrl;
  if (notification.targetType === "manga" && notification.targetId) {
    return buildMangaUrl(notification.targetSlug ?? notification.targetId);
  }
  if (notification.targetType === "post" && notification.targetId) {
    return `/post/${notification.targetId}`;
  }
  return null;
};

export function NotificationPopup({
  isOpen,
  onOpenChange,
  children,
  notifications,
  isLoading,
  errorMessage,
  onNavigate,
  onRetry,
}: NotificationPopupProps) {
  return (
    <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="outline-bd-default bg-bgc-layer1 z-50 flex w-96 max-h-[80vh] flex-col overflow-hidden rounded-lg shadow-[0px_4px_24.200000762939453px_0px_rgba(43,37,75,1.00)] outline-1 outline-offset-[-1px] sm:w-80 sm:max-h-[70vh] md:w-96 md:max-h-[34rem]"
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
            <div className="text-txt-focus cursor-not-allowed font-sans text-sm leading-tight font-medium opacity-50">
              Xem tất cả
            </div>
          </div>

          {/* Notification List */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {isLoading ? (
              <div className="flex flex-1 items-center justify-center py-6">
                <LoadingSpinner />
              </div>
            ) : errorMessage ? (
              <div className="text-txt-secondary flex flex-1 flex-col items-center gap-3 p-4 text-center">
                <span>{errorMessage}</span>
                <button
                  type="button"
                  className="text-txt-focus text-sm font-semibold underline"
                  onClick={onRetry}
                >
                  Thử lại
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-txt-secondary flex flex-1 items-center justify-center p-4 text-center">
                Không có thông báo nào
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-1 pb-3">
                <div className="flex flex-col divide-y divide-bd-default/40">
                  {notifications.map((notification) => {
                    const isBigWin = (notification as any).type === "big-win";
                    const isFollowRelease =
                      (notification as any).type === "follow-release-author" ||
                      (notification as any).type === "follow-release-translator";
                    const isGoldReward = (notification as any).type === "gold-reward";
                    const isMangaRejected = (notification as any).type === "manga-rejected";
                    const isDamNgocReward =
                      isGoldReward ||
                      /dâm\s*ngọc/i.test(`${notification.title || ""} ${notification.subtitle || ""}`) ||
                      (typeof notification.imgUrl === "string" && /\/images\/noti\/gold\.png$/i.test(notification.imgUrl));
                    const targetUrl = resolveTargetUrl(notification);
                    const showGoButton = Boolean(targetUrl);
                    const showSummonWaifuButton = isDamNgocReward;
                    const waifuSummonUrl = "/waifu/summon";

                    const titleClassName = isMangaRejected
                      ? "text-red-500"
                      : isFollowRelease
                        ? "text-success-success"
                        : isGoldReward
                          ? "text-yellow-300"
                          : "text-txt-focus";

                    return (
                      <div
                        key={notification.id}
                        className="bg-bgc-layer1 flex flex-col gap-3 px-3 py-3 first:pt-3"
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`mt-1 h-2 w-2 rounded-full ${
                              !notification.isRead ? "bg-success-success" : "bg-txt-secondary"
                            }`}
                          />
                          <div className="flex flex-col gap-1">
                            {isBigWin ? (
                              <span className="text-yellow-400 font-sans text-sm font-semibold leading-snug">
                                {notification.subtitle || notification.title}
                              </span>
                            ) : (
                              <>
                                <span className={`${titleClassName} font-sans text-sm font-semibold leading-snug`}>
                                  {notification.title}
                                </span>
                                {notification.subtitle && (
                                  <span className="text-txt-primary font-sans text-sm leading-snug">
                                    {notification.subtitle}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-txt-primary font-sans text-xs font-medium uppercase tracking-wide opacity-70">
                            {notification.createdAt && formatDistanceToNow(notification.createdAt)}
                          </span>
                          <div className="flex items-center gap-2">
                            {showSummonWaifuButton ? (
                              <a
                                href={waifuSummonUrl}
                                onClick={() => onNavigate(notification)}
                                className="text-txt-focus flex items-center gap-1 rounded-full border border-transparent px-3 py-1 text-xs font-semibold transition hover:border-txt-focus hover:bg-bgc-layer2"
                              >
                                <ArrowUpRight className="h-3.5 w-3.5" />
                                Đi Triệu Hồi Waifu
                              </a>
                            ) : null}
                            {showGoButton && targetUrl ? (
                              <a
                                href={targetUrl}
                                onClick={() => onNavigate(notification)}
                                className="text-txt-focus flex items-center gap-1 rounded-full border border-transparent px-3 py-1 text-xs font-semibold transition hover:border-txt-focus hover:bg-bgc-layer2"
                              >
                                <ArrowUpRight className="h-3.5 w-3.5" />
                                Đi tới
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
