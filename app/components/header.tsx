import { Link, NavLink } from "react-router";

import { HeaderGenres } from "./header-genres";
import { HeaderSearch } from "./header-search";
import { MobileMenuPublic } from "./mobile-menu-public";
import { MobileSearch } from "./mobile-search";
import { UserMenu } from "./user-menu";

import { ADMIN_NAVIGATION_ITEMS, NAVIGATION_ITEMS } from "~/constants/header";
import type { GenresType } from "~/database/models/genres.model";
import type { UserType } from "~/database/models/user.model";

interface HeaderProps {
  isAdmin?: boolean;
  user?: UserType;
  notificationCount?: number;
  genres?: GenresType[];
}

const getNavigationItems = (
  isMobile: boolean,
  isAdmin: boolean,
  genres?: GenresType[],
) => {
  const navigationItems = isAdmin ? ADMIN_NAVIGATION_ITEMS : NAVIGATION_ITEMS;

  return navigationItems
    .filter((nav) => (isMobile && nav.mobile) || (!isMobile && nav))
    .map((item) => {
      if (item.href === "/genres") {
        return <HeaderGenres key={item.href} genres={genres || []} />;
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
  user,
  notificationCount = 0,
  isAdmin = false,
  genres = [],
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
          <HeaderSearch />

          {/* Phần đăng nhập/đăng ký hoặc người dùng */}
          {user ? (
            <UserMenu
              user={user}
              notificationCount={notificationCount}
              isAdmin={isAdmin}
              isMobile={false}
            />
          ) : (
            <div className="flex items-center justify-start gap-4">
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
            </div>
          )}
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
            <MobileSearch />
            {user ? (
              <UserMenu
                user={user}
                notificationCount={notificationCount}
                isAdmin={isAdmin}
                isMobile={true}
              />
            ) : (
              <MobileMenuPublic />
            )}
          </div>
        </div>
      </div>

      {/* Navigation links - chỉ hiển thị ở desktop */}
      <nav className="hidden items-center justify-center gap-8 self-stretch overflow-hidden bg-[rgba(9,16,26,0.34)] px-8 py-3 md:inline-flex">
        {getNavigationItems(false, isAdmin, genres)}
      </nav>

      {/* Mobile Navigation Menu - Hiển thị menu trên mobile */}
      <nav className="flex w-full flex-row flex-wrap items-center justify-center gap-8 bg-[rgba(9,16,26,0.34)] px-8 py-3 md:hidden">
        {getNavigationItems(true, isAdmin, genres)}
      </nav>
    </header>
  );
}
