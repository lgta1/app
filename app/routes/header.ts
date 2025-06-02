type NavigationItem = {
  label: string;
  href: string;
  mobile?: boolean;
  isDropdown?: boolean;
  isSpecial?: boolean;
  icon?: string;
};

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    label: "Trang chủ",
    href: "/",
  },
  {
    label: "Thể loại",
    href: "/genres",
    mobile: true,
    isDropdown: true,
  },
  {
    label: "Đăng truyện",
    href: "/create-story",
  },
  {
    label: "Xếp hạng",
    href: "/leaderboard",
    mobile: true,
  },
  {
    label: "Triệu hồi Waifu",
    href: "/summon-waifu",
    isSpecial: true,
    icon: "/images/icons/waifu-icon.png",
    mobile: true,
  },
  {
    label: "Diễn đàn",
    href: "/forum",
  },
];

export const ADMIN_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    label: "Thống kê",
    href: "/admin/statistic",
  },
  {
    label: "Quản lý thành viên",
    href: "/admin/member",
  },
  {
    label: "Quản lý truyện",
    href: "/admin/manga",
  },
  {
    label: "Waifu banner",
    href: "/admin/wb",
  },
  {
    label: "Quản lý report",
    href: "/admin/report",
  },
];
