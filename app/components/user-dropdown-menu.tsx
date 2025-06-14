import { useState } from "react";
import { NavLink } from "react-router";
import { Power } from "lucide-react";

export function UserDropdownMenu() {
  const [showTitle, setShowTitle] = useState(true);

  const handleToggleTitle = () => {
    setShowTitle(!showTitle);
    // TODO: Implement toggle title display logic
    console.log("Toggle title display:", !showTitle);
  };

  return (
    <div className="w-full px-6 md:px-0">
      {/* Đăng truyện */}
      <NavLink
        to="/manga/create"
        className="border-bd-default hover:bg-bgc-layer2 flex cursor-pointer items-center justify-start gap-2 border-b p-3 transition-colors md:border-b-0"
      >
        <span className="text-txt-primary justify-center text-center text-base leading-normal font-medium">
          Đăng truyện
        </span>
      </NavLink>

      {/* Sửa hồ sơ */}
      <NavLink
        to="/profile"
        className="border-bd-default hover:bg-bgc-layer2 flex cursor-pointer items-center justify-start gap-2 border-b p-3 transition-colors md:border-b-0"
      >
        <span className="text-txt-primary justify-center text-center text-base leading-normal font-medium">
          Sửa hồ sơ
        </span>
      </NavLink>

      {/* Đổi mật khẩu */}
      <NavLink
        to="/profile/change-password"
        className="border-bd-default hover:bg-bgc-layer2 flex cursor-pointer items-center justify-start gap-2 border-b p-3 transition-colors md:border-b-0"
      >
        <span className="text-txt-primary justify-center text-center text-base leading-normal font-medium">
          Đổi mật khẩu
        </span>
      </NavLink>

      {/* Hiển thị cấp với toggle switch */}
      <div className="border-bd-default flex items-center justify-start gap-2 border-b p-3 md:border-b-0">
        <span className="text-txt-primary justify-center text-base leading-normal font-medium">
          Hiển thị cấp
        </span>
        <div
          className={`flex h-6 w-10 cursor-pointer items-center justify-start overflow-hidden rounded-full py-1 pr-1 pl-5 transition-colors ${
            showTitle ? "bg-success-success" : "bg-txt-tertiary"
          }`}
          onClick={handleToggleTitle}
        >
          <div className="h-4 w-4 rounded-full bg-white shadow-[0px_0px_1px_0px_rgba(0,0,0,0.30)] shadow-[0px_0px_5px_0px_rgba(0,0,0,0.02)] shadow-[0px_2px_10px_0px_rgba(0,0,0,0.06)]" />
        </div>
      </div>

      {/* Đăng xuất */}
      <NavLink
        to="/logout"
        className="border-bd-default hover:bg-bgc-layer2 flex cursor-pointer items-center justify-start gap-2 border-b p-3 transition-colors md:border-b-0"
      >
        <Power className="h-4 w-4 text-[#E03F46]" />
        <span className="justify-center text-base leading-normal font-medium text-[#E03F46]">
          Đăng xuất
        </span>
      </NavLink>
    </div>
  );
}
