export const formatDistanceToNow = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diff / (1000 * 60));
  const diffInHours = Math.floor(diff / (1000 * 60 * 60));
  const diffInDays = Math.floor(diff / (1000 * 60 * 60 * 24));
  const diffInMonths = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
  const diffInYears = Math.floor(diff / (1000 * 60 * 60 * 24 * 365));

  if (diffInYears > 0) {
    return `${diffInYears} năm trước`;
  }
  if (diffInMonths > 0) {
    return `${diffInMonths} tháng trước`;
  }
  if (diffInDays > 0) {
    return `${diffInDays} ngày trước`;
  }
  if (diffInHours > 0) {
    return `${diffInHours} giờ trước`;
  }
  if (diffInMinutes > 0) {
    return `${diffInMinutes} phút trước`;
  }

  return "vừa xong";
};

export const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const formatTime = (date: Date): string => {
  return new Date(date).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};
