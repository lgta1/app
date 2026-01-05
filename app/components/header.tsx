import { useEffect, useRef, useState } from "react";
import { Shuffle } from "lucide-react";

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
  genres?: GenresType[];
  hideBanner?: boolean;
  disableAutoHide?: boolean;
  isFixed?: boolean;
  autoPrefetchNotifications?: boolean;
}

// Build navigation items list
const getNavigationItems = (
  isMobile: boolean,
  isAdmin: boolean,
  genres: GenresType[] | undefined,
) => {
  const navigationItems = isAdmin ? ADMIN_NAVIGATION_ITEMS : NAVIGATION_ITEMS;

  const baseTypography = isMobile
    ? "text-sm leading-tight"
    : "text-sm lg:text-[17px] leading-tight"; // desktop: +0.5 step ~17px, keep tight line-height
  const outlineClass = isMobile ? "text-outline-purple-thin" : "text-outline-purple";
  const linkClass = `inline-flex items-center justify-center px-2 py-1 rounded-md touch-manipulation ${baseTypography} font-semibold whitespace-nowrap text-center text-txt-primary ${outlineClass} shrink-0`;

  return navigationItems
    .filter((nav) => (isMobile && nav.mobile) || (!isMobile && nav))
    .map((item) => {
      if (item.href === "/genres") {
        return (
          <div key={item.href} className="max-[375px]:min-w-0 shrink-0 whitespace-nowrap">
            <HeaderGenres genres={genres || []} />
          </div>
        );
      }

      if (item.isSpecial) {
        return (
          <div key={item.href} className="flex h-6 items-center justify-center whitespace-nowrap max-[375px]:min-w-0 shrink-0">
            {!isMobile && item.icon ? (
              <img src={item.icon} alt={item.label} className="hidden lg:inline-block h-6 pointer-events-none select-none" />
            ) : null}
            <a
              href={item.href}
              className={linkClass}
            >
              {item.label}
            </a>
          </div>
        );
      }

      return (
        <a
          key={item.href}
          href={item.href}
          className={linkClass}
        >
          {item.label}
        </a>
      );
    });
};

const RandomNavButton = () => (
  <a
    key="nav-random-button"
    href="/random"
    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] via-[#A855F7] to-[#C084FC] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(124,58,237,0.35)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(124,58,237,0.45)]"
  >
    <Shuffle className="h-4 w-4" />
    <span>Random</span>
  </a>
);


export function Header({ user, isAdmin = false, genres = [], hideBanner = false, disableAutoHide = false, isFixed = true, autoPrefetchNotifications = false }: HeaderProps) {
  const [isHidden, setIsHidden] = useState(false);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const [bannerMounted, setBannerMounted] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [isHome, setIsHome] = useState(false);
  const bannerName = (user as any)?.displayName || (user as any)?.username || (user as any)?.name || "";

  // Headroom-like behavior
  useEffect(() => {
    if (disableAutoHide || !isFixed) {
      setIsHidden(false);
      return;
    }
    let lastY = window.scrollY || 0;
    let ticking = false;
    const threshold = 1;
    const sensitivity = 1;

    const onScroll = () => {
      const currentY = window.scrollY || 0;
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const delta = currentY - lastY;
        if (currentY <= 0) {
          setIsHidden(false);
        } else if (delta > sensitivity && currentY > threshold) {
          setIsHidden(true);
        } else if (delta < -sensitivity) {
          setIsHidden(false);
        }
        lastY = currentY;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [disableAutoHide, isFixed]);

  // Banner display once per session
  useEffect(() => {
    if (hideBanner) {
      setBannerVisible(false);
      setBannerMounted(false);
      return;
    }
    try {
      if (sessionStorage.getItem("vh_banner_shown")) {
        setBannerVisible(false);
        setBannerMounted(false);
        return;
      }
      sessionStorage.setItem("vh_banner_shown", "1");
    } catch {}

    setBannerMounted(true);
    const rafId = window.requestAnimationFrame(() => setBannerVisible(true));
    const visibleDuration = 4500;
    const animDuration = 300;
    const hideTimer = window.setTimeout(() => {
      setBannerVisible(false);
      window.setTimeout(() => setBannerMounted(false), animDuration);
    }, visibleDuration);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(hideTimer);
    };
  }, [hideBanner]);

  // Detect homepage to scale logo only on index
  useEffect(() => {
    try {
      const path = window.location?.pathname || "";
      setIsHome(path === "/" || path === "/index");
    } catch {}
  }, []);


  return (
    <header className="flex w-full flex-col">
      {/* Banner */}
      {bannerMounted && !hideBanner && (
        <div
          ref={bannerRef}
          className={`fixed left-0 right-0 bottom-4 z-[60] bg-lav-500 flex items-center justify-center mx-auto max-w-[1200px] px-3 py-2 md:gap-4 md:px-8 rounded-md shadow-lg transition-transform transition-opacity duration-300 ease-out ${
            bannerVisible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
          }`}
          role="dialog"
          aria-live="polite"
        >
          <img src="/images/icons/star-icon.svg" alt="Star" className="hidden h-2 w-2 md:block md:h-4 md:w-4" />
          <span className="text-center text-[10px] leading-tight font-semibold text-[#0A1020] md:text-sm max-[376px]:hidden">
            {bannerName
              ? `VinaHentai không đặt quảng cáo, chúc đồng dâm ${bannerName} đọc truyện vui vẻ ❤️`
              : `VinaHentai không đặt quảng cáo, chúc đồng dâm đọc truyện vui vẻ ❤️`}
          </span>
          <span className="hidden text-center text-[10px] leading-tight font-semibold text-[#0A1020] md:text-sm max-[376px]:inline">
            {bannerName
              ? `VinaHentai không đặt quảng cáo. Chúc ${bannerName} đọc truyện vui vẻ ❤️`
              : `VinaHentai không đặt quảng cáo. Cảm ơn đồng dâm ❤️`}
          </span>
          <img src="/images/icons/star-icon.svg" alt="Star" className="hidden h-2 w-2 md:block md:h-4 md:w-4" />
        </div>
      )}

      {/* Fixed wrapper */}
      <div
        className={
          isFixed
            ? `fixed left-0 right-0 z-50 transition-transform duration-300 will-change-transform ${
                isHidden ? "-translate-y-full" : "translate-y-0"
              }`
            : `relative z-20`
        }
        style={isFixed ? { top: 0, height: "var(--site-header-height)" } : undefined}
      >
        {/* Top strip: desktop constrained to container, mobile unchanged */}
        <div className="relative flex items-center justify-between self-stretch overflow-hidden bg-[rgba(9,16,26,0.85)] px-0 pt-2.5 pb-0.5 shadow-lg backdrop-blur-sm md:bg-[rgba(9,16,26,0.9)] md:pb-2">
          {/* Desktop >= lg (tablet uses mobile header) */}
          <div className="hidden lg:block w-full">
            <div className="container-page mx-auto px-4 relative flex items-center justify-between">
              {/* Left: Logo */}
              <div className="flex items-center">
                <a href="/">
                  <img
                    src="/images/logo2.webp"
                    alt="VinaHentai Logo"
                    className={`h-auto w-50 cursor-pointer md:transition-transform ${isHome ? "md:scale-[0.90]" : ""}`}
                    style={{ transformOrigin: "left center" }}
                  />
                </a>
              </div>
              {/* Center: Search absolutely centered in this container */}
              <HeaderSearch />
              {/* Right: Auth/user */}
              {user ? (
                <UserMenu user={user} isAdmin={isAdmin} isMobile={false} autoPrefetchNotifications={autoPrefetchNotifications} />
              ) : (
                <div className="flex items-center justify-start gap-4">
                  <a href="/login" className="outline-lav-500 flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 outline outline-offset-[-1px]">
                    <span className="text-txt-focus text-center text-sm leading-tight font-medium">Đăng nhập</span>
                  </a>
                  <a href="/register" className="flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 shadow-[0px_4px_9px_rgba(196,69,255,0.25)]">
                    <span className="text-center text-sm leading-tight font-semibold text-black">Đăng ký</span>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Mobile + tablet < lg */}
          <div className="flex w-full items-center justify-between px-4 lg:hidden sm:px-8">
            <a href="/">
              <img src="/images/logo2.webp" alt="VinaHentai Logo" className="h-10 w-auto cursor-pointer" />
            </a>
            <div className="flex items-center gap-2 sm:gap-3">
              <MobileSearch />
              {user ? (
                <UserMenu user={user} isAdmin={isAdmin} isMobile={true} autoPrefetchNotifications={autoPrefetchNotifications} />
              ) : (
                <MobileMenuPublic />
              )}
            </div>
          </div>
        </div>

        {/* Desktop nav links */}
        <nav className="hidden items-center justify-center gap-8 overflow-hidden bg-[rgba(9,16,26,0.8)] px-8 py-[0.55rem] lg:flex lg:w-full -mt-1.5">
          {getNavigationItems(false, isAdmin, genres)}
          {RandomNavButton()}
        </nav>

        {/* Mobile nav menu */}
        <nav className="relative z-30 flex w-full flex-row flex-nowrap items-center justify-center gap-4 overflow-x-auto bg-[rgba(9,16,26,0.85)] px-4 pt-[0.15rem] pb-[0.6rem] lg:hidden no-scrollbar touch-pan-x md:bg-[rgba(9,16,26,0.8)] md:py-[0.6rem] max-[376px]:gap-2 max-[376px]:px-2">
          {getNavigationItems(true, isAdmin, genres)}
        </nav>

        {/* Divider */}
        <div className="h-[1px] w-full bg-[rgba(255,255,255,0.06)]" />
      </div>

      {/* Spacer for fixed header */}
      {isFixed ? <div style={{ height: `var(--site-header-height, var(--site-header-height-base))` }} /> : null}
    </header>
  );
}

