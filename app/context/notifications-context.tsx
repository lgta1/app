import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFetcher } from "react-router-dom";

import type { NotificationType } from "~/database/models/notification.model";

interface NotificationsResponse {
  success: boolean;
  data: NotificationType[];
  totalUnreadCount?: number;
  message?: string;
}

type NotificationsContextValue = {
  notifications: NotificationType[];
  unreadCount: number;
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  loadNotifications: (options?: { force?: boolean }) => void;
  markNotificationsRead: (ids: string[]) => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
  initialUnreadCount?: number;
  initialNotifications?: NotificationType[];
};

const normalizeNotifications = (rows: NotificationType[] | undefined | null) => {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    ...row,
    id: String((row as any)?.id ?? (row as any)?._id ?? ""),
  }));
};

const MAX_CLIENT_NOTIFICATIONS = 10;

const postNotificationAction = async (payload: Record<string, string>) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => formData.append(key, value));
  const response = await fetch("/api/notifications", { method: "POST", body: formData });
  const json = await response.json();
  if (!json?.success) {
    throw new Error(json?.message || "Không thể cập nhật thông báo");
  }
  return json;
};

export function NotificationsProvider({
  children,
  initialUnreadCount = 0,
  initialNotifications,
}: ProviderProps) {
  const fetcher = useFetcher<NotificationsResponse>();
  const hasInitialSnapshot = Array.isArray(initialNotifications);
  const initialRows = useMemo(
    () => normalizeNotifications(initialNotifications).slice(0, MAX_CLIENT_NOTIFICATIONS),
    [initialNotifications],
  );
  const [notifications, setNotifications] = useState<NotificationType[]>(initialRows);
  const [unreadCount, setUnreadCount] = useState(() => {
    if (initialRows.length > 0) {
      return initialRows.filter((item) => !item.isRead).length;
    }
    return initialUnreadCount;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(hasInitialSnapshot);
  const [error, setError] = useState<string | null>(null);
  const pendingLoadRef = useRef(false);

  const loadNotifications = useCallback(
    ({ force = false }: { force?: boolean } = {}) => {
      if (pendingLoadRef.current) return;
      if (!force) {
        if (hasLoaded) return;
        if (fetcher.state !== "idle") return;
      }
      pendingLoadRef.current = true;
      setIsLoading(true);
      setError(null);
      fetcher.load("/api/notifications");
    },
    [fetcher, hasLoaded],
  );

  const resetAndForceReload = useCallback(() => {
    pendingLoadRef.current = false;
    loadNotifications({ force: true });
  }, [loadNotifications]);

  useEffect(() => {
    if (hasLoaded) return;
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount, hasLoaded]);

  useEffect(() => {
    if (!hasInitialSnapshot) return;
    setNotifications(initialRows);
    const unread = initialRows.filter((item) => !item.isRead).length;
    setUnreadCount(unread);
    setHasLoaded(true);
  }, [hasInitialSnapshot, initialRows]);

  useEffect(() => {
    if (!pendingLoadRef.current) return;
    if (fetcher.state === "loading") {
      setIsLoading(true);
    }
    if (fetcher.state === "idle" && !fetcher.data) {
      // Network error? allow future retries
      pendingLoadRef.current = false;
      setIsLoading(false);
    }
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    if (!fetcher.data) return;
    pendingLoadRef.current = false;
    if (fetcher.data.success) {
      const next = normalizeNotifications(fetcher.data.data).slice(0, MAX_CLIENT_NOTIFICATIONS);
      setNotifications(next);
      const unreadFromPayload = typeof fetcher.data.totalUnreadCount === "number"
        ? fetcher.data.totalUnreadCount
        : next.filter((item) => !item.isRead).length;
      setUnreadCount(unreadFromPayload);
      setHasLoaded(true);
      setIsLoading(false);
      setError(null);
    } else {
      setError(fetcher.data.message || "Không thể tải thông báo");
      setIsLoading(false);
      setHasLoaded(false);
    }
  }, [fetcher.data]);

  useEffect(() => {
    if (!isLoading) return;
    const timeoutId = window.setTimeout(() => {
      if (fetcher.state === "loading") {
        pendingLoadRef.current = false;
        setIsLoading(false);
        setError((prev) => prev || "Thông báo đang phản hồi chậm, vui lòng thử lại.");
      }
    }, 8000);
    return () => window.clearTimeout(timeoutId);
  }, [isLoading, fetcher.state]);

  const markNotificationsRead = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      let newlyRead = 0;
      setNotifications((prev) =>
        prev.map((item) => {
          if (!item.isRead && ids.includes(item.id)) {
            newlyRead += 1;
            return { ...item, isRead: true };
          }
          return item;
        }),
      );
      if (newlyRead > 0) {
        setUnreadCount((prev) => Math.max(prev - newlyRead, 0));
      }
      try {
        await postNotificationAction({
          action: "read",
          notificationIds: JSON.stringify(ids),
        });
      } catch (err) {
        setError((err as Error)?.message || "Không thể cập nhật trạng thái đọc");
        resetAndForceReload();
      }
    },
    [resetAndForceReload],
  );

  const value = useMemo<NotificationsContextValue>(() => ({
    notifications,
    unreadCount,
    isLoading,
    hasLoaded,
    error,
    loadNotifications,
    markNotificationsRead,
  }), [notifications, unreadCount, isLoading, hasLoaded, error, loadNotifications, markNotificationsRead]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotificationsContext must be used within NotificationsProvider");
  }
  return context;
}
