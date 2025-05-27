import { Link } from "react-router";
import { Bell, ChevronDown, Menu, Search } from "lucide-react";

interface HeaderProps {
  isAuthenticated?: boolean;
  username?: string;
  notificationCount?: number;
}

export function Header({
  isAuthenticated = false,
  username = "",
  notificationCount = 0,
}: HeaderProps) {
  return (
    <header className="flex w-full flex-col">
      {/* Banner thông báo */}
      <div className="bg-lav-500 flex w-full items-center justify-center overflow-hidden px-1 py-2 md:gap-4 md:px-8">
        <img
          src="/images/icons/star-icon.svg"
          alt="Star"
          className="hidden h-2 w-2 md:block md:h-4 md:w-4"
        />
        <span className="text-center text-[10px] leading-tight font-semibold text-[#0A1020] md:text-sm">
          VinaHentai đặt quảng cáo để duy trì web. Cảm ơn đồng dâm đã thông cảm và ủng hộ
          ❤️
        </span>
        <img
          src="/images/icons/star-icon.svg"
          alt="Star"
          className="hidden h-2 w-2 md:block md:h-4 md:w-4"
        />
      </div>

      {/* Phần navigation chính */}
      <div className="relative flex items-center justify-between self-stretch overflow-hidden bg-[rgba(9,16,26,0.71)] px-8 py-2.5 shadow-lg backdrop-blur-sm">
        {/* Desktop view - ẩn trên mobile */}
        <div className="hidden md:contents">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/">
              <img
                src="/images/logo.png"
                alt="WuxiaWorld Logo"
                className="h-auto w-30 cursor-pointer"
              />
            </Link>
          </div>

          {/* Thanh tìm kiếm */}
          <div className="bg-bgc-layer2 absolute left-1/2 flex w-80 -translate-x-1/2 transform items-center justify-start gap-2 rounded-xl px-3 py-1.5">
            <Search className="text-txt-secondary h-5 w-5" />
            <span className="text-txt-secondary text-base leading-normal font-medium">
              Tìm truyện
            </span>
          </div>

          {/* Phần đăng nhập/đăng ký hoặc người dùng */}
          <div className="flex items-center justify-start gap-4">
            {isAuthenticated ? (
              <>
                {/* Hiển thị khi đã đăng nhập */}
                <div className="relative">
                  <Bell className="text-txt-primary h-6 w-6" />
                  {notificationCount > 0 && (
                    <div className="text-txt-primary absolute top-[-5px] right-[-5px] rounded-lg bg-[#E03F46] px-1 py-[2px] text-[8px] font-semibold">
                      {notificationCount}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-bgc-layer2 h-8 w-8 overflow-hidden rounded-full">
                    {/* Avatar có thể thay bằng ảnh người dùng */}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-txt-primary text-base font-medium">
                      {username}
                    </span>
                    <ChevronDown className="text-txt-primary h-5 w-5" />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Hiển thị khi chưa đăng nhập */}
                <Link
                  to="/login"
                  className="outline-lav-500 flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 outline outline-1 outline-offset-[-1px]"
                >
                  <span className="text-lav-500 text-center text-sm leading-tight font-medium">
                    Đăng nhập
                  </span>
                </Link>
                <Link
                  to="/register"
                  className="flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 shadow-[0px_4px_9px_rgba(196,69,255,0.25)]"
                >
                  <span className="text-center text-sm leading-tight font-semibold text-black">
                    Đăng ký
                  </span>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile view - ẩn trên desktop */}
        <div className="flex w-full items-center justify-between md:hidden">
          <Link to="/">
            <img
              src="/images/logo.png"
              alt="WuxiaWorld Logo"
              className="h-9 w-auto cursor-pointer"
            />
          </Link>

          <div className="flex items-center gap-4">
            {isAuthenticated && (
              <div className="relative">
                <Bell className="text-txt-primary h-6 w-6" />
                {notificationCount > 0 && (
                  <div className="text-txt-primary absolute top-[-5px] right-[-5px] rounded-lg bg-[#E03F46] px-1 py-[2px] text-[8px] font-semibold">
                    {notificationCount}
                  </div>
                )}
              </div>
            )}
            <Search className="text-txt-primary h-6 w-6" />
            <Menu className="text-txt-primary h-7 w-7" />
          </div>
        </div>
      </div>

      {/* Navigation links - chỉ hiển thị ở desktop */}
      <nav className="hidden items-center justify-center gap-8 self-stretch overflow-hidden bg-[rgba(9,16,26,0.34)] px-8 py-3 md:inline-flex">
        <Link to="/" className="text-lav-500 text-sm leading-normal font-semibold">
          Trang chủ
        </Link>
        <div className="flex items-center justify-start gap-1">
          <Link
            to="/the-loai"
            className="text-txt-primary text-sm leading-normal font-semibold"
          >
            Thể loại
          </Link>
          <ChevronDown className="text-txt-primary h-3 w-3" />
        </div>
        <Link
          to="/dang-truyen"
          className="text-txt-primary text-sm leading-normal font-semibold"
        >
          Đăng truyện
        </Link>
        <Link
          to="/xep-hang"
          className="text-txt-primary text-sm leading-normal font-semibold"
        >
          Xếp hạng
        </Link>
        <div className="flex h-6 items-center justify-center">
          <img src="/images/icons/waifu-icon.png" alt="Waifu" className="h-6" />
          <Link
            to="/trieu-hoi-waifu"
            className="text-txt-primary text-sm leading-normal font-semibold"
          >
            Triệu hồi Waifu
          </Link>
        </div>
        <Link
          to="/dien-dan"
          className="text-txt-primary text-sm leading-normal font-semibold"
        >
          Diễn đàn
        </Link>
      </nav>

      {/* Mobile Navigation Menu - Hiển thị menu trên mobile */}
      <nav className="flex w-full flex-row items-center justify-center gap-8 bg-[rgba(9,16,26,0.34)] px-8 py-3 md:hidden">
        <div className="flex items-center gap-1">
          <Link
            to="/the-loai"
            className="text-txt-primary flex items-center justify-start gap-1 text-sm leading-normal font-semibold"
          >
            Thể loại
          </Link>
          <ChevronDown className="text-txt-primary h-3 w-3" />
        </div>
        <Link
          to="/xep-hang"
          className="text-txt-primary text-sm leading-normal font-semibold"
        >
          Xếp hạng
        </Link>
        <div className="flex items-center gap-[-5px]">
          <img src="/images/icons/waifu-icon.png" alt="Waifu" className="h-6" />
          <Link
            to="/trieu-hoi-waifu"
            className="text-txt-primary text-sm leading-normal font-semibold"
          >
            Triệu hồi Waifu
          </Link>
        </div>
      </nav>
    </header>
  );
}
