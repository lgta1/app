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
    mobile: true, // 👈 thêm dòng này để hiển thị trên mobile
  },
  {
    label: "Thể loại",
    href: "/genres",
    mobile: true,
    isDropdown: true,
  },
  {
    label: "🏆 BXH",
    href: "/leaderboard",
    mobile: true,
  },
  {
    label: "Triệu hồi Waifu",
    href: "/waifu/summon",
    isSpecial: true,
    icon: "/images/icons/waifu-icon.png",
    mobile: true,
  },
  {
    label: "Đăng truyện",
    href: "/truyen-hentai/manage",
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
    label: "Quyền watermark",
    href: "/admin/roles/skip-watermark",
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
