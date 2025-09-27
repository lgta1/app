import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

interface DropdownOption {
  value: string | number;
  label: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value?: string | number;
  placeholder?: string;
  onSelect: (value: any) => void;
  className?: string;
  disabled?: boolean;

  // BEGIN feature: chapter dropdown UX
  /** Chuỗi hiển thị trên NÚT (ví dụ: "Chương 12"). Menu vẫn dựa trên options. */
  buttonLabel?: string;

  /** Tuỳ biến nhãn mỗi OPTION trong menu (ví dụ: "Chương {số} — {tiêu đề}") */
  renderOptionLabel?: (option: DropdownOption) => JSX.Element | string;

  /** Hệ số rộng menu so với nút; mặc định = 2 để đạt “rộng gấp đôi nút”. */
  menuWidthMultiplier?: number;
  // END feature: chapter dropdown UX
}

export function Dropdown({
  options,
  value,
  placeholder = "Chọn một tùy chọn",
  onSelect,
  className = "",
  disabled = false,
  // BEGIN feature: chapter dropdown UX
  buttonLabel,
  renderOptionLabel,
  menuWidthMultiplier = 2,
  // END feature: chapter dropdown UX
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null); // detect click outside (button)
  const buttonRef = useRef<HTMLButtonElement>(null); // đo kích thước/tọa độ nút

  // BEGIN feature: portal
  const [coords, setCoords] = useState<{ left: number; top: number; width: number }>({
    left: 0,
    top: 0,
    width: 0,
  });
  const menuPortalRootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Tạo root cho portal 1 lần
  useEffect(() => {
    const node = document.createElement("div");
    node.setAttribute("data-dropdown-portal", "true");
    document.body.appendChild(node);
    menuPortalRootRef.current = node;
    return () => {
      if (menuPortalRootRef.current) {
        document.body.removeChild(menuPortalRootRef.current);
        menuPortalRootRef.current = null;
      }
    };
  }, []);

  // Tính tọa độ & width của menu khi mở; update on resize/scroll
  useEffect(() => {
    if (!isOpen) return;
    const calc = () => {
      const el = buttonRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const factor =
        Number.isFinite(menuWidthMultiplier) && (menuWidthMultiplier as number) > 0
          ? (menuWidthMultiplier as number)
          : 2;
      const width = Math.max(160, Math.floor(r.width * factor));
      const vw = window.innerWidth || document.documentElement.clientWidth;
      let left = Math.floor(r.left); // căn trái với nút
      // nếu tràn màn hình bên phải -> dịch trái cho vừa viewport
      if (left + width > vw - 8) {
        left = Math.max(8, vw - 8 - width);
      }
      const top = Math.floor(r.bottom + 8); // giống mt-2
      setCoords({ left, top, width });
    };
    calc();
    window.addEventListener("resize", calc);
    // listen cả scroll trong mọi container (capture)
    window.addEventListener("scroll", calc, true);
    return () => {
      window.removeEventListener("resize", calc);
      window.removeEventListener("scroll", calc, true);
    };
  }, [isOpen, menuWidthMultiplier]);
  // END feature: portal

  // Close dropdown khi click ngoài (kể cả ngoài menu portal)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const clickedInButtonArea = containerRef.current?.contains(target) ?? false;
      const clickedInMenu = menuRef.current?.contains(target) ?? false;
      if (!clickedInButtonArea && !clickedInMenu) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Đóng bằng ESC khi mở
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const handleSelect = (optionValue: string | number) => {
    onSelect(optionValue);
    setIsOpen(false);
  };

  const selectedOption = options.find((opt) => opt.value === value);
  const triggerText = buttonLabel ?? selectedOption?.label ?? placeholder;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`bg-bgc-layer2 border-bd-default flex w-full items-center justify-between rounded-xl border px-3 py-2.5 font-sans text-base font-medium transition-colors focus:outline-none ${
          disabled
            ? "text-txt-secondary cursor-not-allowed opacity-50"
            : "text-txt-primary focus:border-lav-500 hover:border-txt-secondary"
        } `}
      >
        <span
          className={selectedOption ? "text-txt-primary truncate" : "text-txt-secondary truncate"}
        >
          {triggerText}
        </span>
        <ChevronDown
          className={`text-txt-secondary h-6 w-6 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* BEGIN feature: portal */}
      {isOpen && !disabled && menuPortalRootRef.current
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              className="bg-bgc-layer2 border-bd-default fixed z-[999] max-h-60 overflow-y-auto rounded-xl border shadow-lg"
              style={{ left: coords.left, top: coords.top, width: coords.width }}
            >
              {options.map((option) => (
                <button
                  role="option"
                  aria-selected={value === option.value}
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full px-3 py-2.5 text-left font-sans text-base font-medium transition-colors first:rounded-t-xl last:rounded-b-xl ${
                    value === option.value
                      ? "bg-bgc-layer-semi-purple text-txt-focus"
                      : "text-txt-primary hover:bg-bgc-layer-semi-neutral"
                  } `}
                  title={typeof option.label === "string" ? option.label : undefined}
                >
                  {/* Cho phép hiển thị "Chương {số} — {tiêu đề}" nếu truyền renderOptionLabel */}
                  {renderOptionLabel ? renderOptionLabel(option) : option.label}
                </button>
              ))}
            </div>,
            menuPortalRootRef.current,
          )
        : null}
      {/* END feature: portal */}
    </div>
  );
}
