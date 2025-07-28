import { NavLink } from "react-router";
import { Power } from "lucide-react";

export function UserDropdownMenu({
  setIsUserMenuOpen,
}: {
  setIsUserMenuOpen: (isOpen: boolean) => void;
}) {
  return (
    <div className="w-full px-6 md:px-0">
      {/* Đăng truyện */}
      <NavLink
        to="/manga/create"
        className="border-bd-default hover:bg-bgc-layer2 flex cursor-pointer items-center justify-start gap-2 border-b px-4 py-3 transition-colors md:border-b-0"
        onClick={() => setIsUserMenuOpen(false)}
      >
        <span className="text-txt-primary justify-center text-center text-base leading-normal font-medium">
          Đăng truyện
        </span>
      </NavLink>

      {/* Sửa hồ sơ */}
      <NavLink
        to="/profile"
        className="border-bd-default hover:bg-bgc-layer2 flex cursor-pointer items-center justify-start gap-2 border-b px-4 py-3 transition-colors md:border-b-0"
        onClick={() => setIsUserMenuOpen(false)}
      >
        <span className="text-txt-primary justify-center text-center text-base leading-normal font-medium">
          Trang cá nhân
        </span>
      </NavLink>

      {/* Đổi mật khẩu */}
      <NavLink
        to="/change-password"
        className="border-bd-default hover:bg-bgc-layer2 flex cursor-pointer items-center justify-start gap-2 border-b px-4 py-3 transition-colors md:border-b-0"
        onClick={() => setIsUserMenuOpen(false)}
      >
        <span className="text-txt-primary justify-center text-center text-base leading-normal font-medium">
          Đổi mật khẩu
        </span>
      </NavLink>

      {/* Đăng xuất */}
      <NavLink
        to="/logout"
        className="border-bd-default hover:bg-bgc-layer2 flex cursor-pointer items-center justify-start gap-2 border-b px-4 py-3 transition-colors md:border-b-0"
        onClick={() => setIsUserMenuOpen(false)}
      >
        <Power className="h-4 w-4 text-[#E03F46]" />
        <span className="justify-center text-base leading-normal font-medium text-[#E03F46]">
          Đăng xuất
        </span>
      </NavLink>
    </div>
  );
}
