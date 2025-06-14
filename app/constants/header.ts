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
    href: "/manga/create",
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
    mobile: true,
  },
  {
    label: "Quản lý thành viên",
    href: "/admin/member",
    mobile: true,
  },
  {
    label: "Quản lý truyện",
    href: "/admin/manga",
    mobile: true,
  },
  {
    label: "Waifu banner",
    href: "/admin/waifu",
    mobile: true,
  },
  {
    label: "Quản lý report",
    href: "/admin/report",
    mobile: true,
  },
];
