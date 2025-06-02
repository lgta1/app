import { Link, NavLink } from "react-router";
import { Bell, ChevronDown, CircleUserRound, Menu, Search } from "lucide-react";

import { ADMIN_NAVIGATION_ITEMS, NAVIGATION_ITEMS } from "~/constants/header";
import type { UserType } from "~/database/models/user.model";
import { getTitleImgPath } from "~/helpers/user";

interface HeaderProps {
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  user?: UserType;
  notificationCount?: number;
}

const getNavigationItems = (isMobile: boolean, isAdmin: boolean) => {
  const navigationItems = isAdmin ? ADMIN_NAVIGATION_ITEMS : NAVIGATION_ITEMS;

  return navigationItems
    .filter((nav) => (isMobile && nav.mobile) || (!isMobile && nav))
    .map((item) => {
      if (item.isDropdown) {
        return (
          <div key={item.href} className="flex items-center justify-start gap-1">
            <NavLink
              to={item.href}
              className={({ isActive }) =>
                `text-sm leading-normal font-semibold ${
                  isActive ? "text-lav-500" : "text-txt-primary"
                }`
              }
            >
              {item.label}
            </NavLink>
            <ChevronDown className="text-txt-primary h-3 w-3" />
          </div>
        );
      }

      if (item.isSpecial) {
        return (
          <div key={item.href} className="flex h-6 items-center justify-center">
            <img src={item.icon || ""} alt={item.label} className="h-6" />
            <NavLink
              to={item.href}
              className={({ isActive }) =>
                `text-sm leading-normal font-semibold ${
                  isActive ? "text-lav-500" : "text-txt-primary"
                }`
              }
            >
              {item.label}
            </NavLink>
          </div>
        );
      }

      return (
        <NavLink
          key={item.href}
          to={item.href}
          className={({ isActive }) =>
            `text-sm leading-normal font-semibold ${
              isActive ? "text-lav-500" : "text-txt-primary"
            }`
          }
        >
          {item.label}
        </NavLink>
      );
    });
};

export function Header({
  isAuthenticated = false,
  user,
  notificationCount = 0,
  isAdmin = false,
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
                  <CircleUserRound className="h-7 w-7" />
                  <div className="flex items-center gap-2">
                    <span className="text-txt-primary text-base font-medium">
                      {user?.name}
                    </span>
                    {user && (
                      <img src={getTitleImgPath(user)} alt="Title" className="h-6 w-28" />
                    )}
                    <ChevronDown className="text-txt-primary h-4 w-4" />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Hiển thị khi chưa đăng nhập */}
                <Link
                  to="/login"
                  className="outline-lav-500 flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 outline outline-offset-[-1px]"
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
        {getNavigationItems(false, isAdmin)}
      </nav>

      {/* Mobile Navigation Menu - Hiển thị menu trên mobile */}
      <nav className="flex w-full flex-row items-center justify-center gap-8 bg-[rgba(9,16,26,0.34)] px-8 py-3 md:hidden">
        {getNavigationItems(true, isAdmin)}
      </nav>
    </header>
  );
}
