import { type ReactNode, useEffect, useRef, useState } from "react";
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
  renderOptionLabel?: (option: DropdownOption) => ReactNode;

  /** Hệ số rộng menu so với nút; mặc định = 2 để đạt “rộng gấp đôi nút”. */
  menuWidthMultiplier?: number;
  // END feature: chapter dropdown UX

  // 👇 [EDIT] NEW PROP: điều khiển hướng bung menu
  /** Hướng hiển thị menu: 'down' (mặc định) hoặc 'up' cho sticky bottom */
  placement?: "down" | "up";
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

  // 👇 [EDIT] destructure prop mới
  placement = "down",
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
  // NOTE: dùng state để trigger rerender khi portal root được tạo.
  // Tránh race-condition: user click mở dropdown trước khi useEffect chạy.
  const [menuPortalRoot, setMenuPortalRoot] = useState<HTMLDivElement | null>(null);
  const menuPortalRootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Tạo root cho portal 1 lần
  useEffect(() => {
    const node = document.createElement("div");
    node.setAttribute("data-dropdown-portal", "true");
    document.body.appendChild(node);
    menuPortalRootRef.current = node;
    setMenuPortalRoot(node);
    return () => {
      if (menuPortalRootRef.current) {
        document.body.removeChild(menuPortalRootRef.current);
        menuPortalRootRef.current = null;
      }
      setMenuPortalRoot(null);
    };
  }, []);

  // 👇 [EDIT] bổ sung logic xác định vị trí theo placement
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
      let left = Math.floor(r.left);
      if (left + width > vw - 8) {
        left = Math.max(8, vw - 8 - width);
      }

      const GAP = 8;
      let top: number;
      if (placement === "up") {
        // 👇 [EDIT] Nếu hướng lên: căn theo top của button
        top = Math.floor(r.top - GAP);
      } else {
        // hướng xuống (mặc định)
        top = Math.floor(r.bottom + GAP);
      }
      setCoords({ left, top, width });
    };

    calc();
    window.addEventListener("resize", calc);
    window.addEventListener("scroll", calc, true);
    return () => {
      window.removeEventListener("resize", calc);
      window.removeEventListener("scroll", calc, true);
    };
  }, [isOpen, menuWidthMultiplier, placement]);
  // END feature: portal

  // Close dropdown khi click ngoài
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

  // 👇 [NEW] Khi mở menu, tự động cuộn để option đang chọn nằm giữa panel
  useEffect(() => {
    if (!isOpen) return;
    const panel = menuRef.current;
    if (!panel) return;
    requestAnimationFrame(() => {
      const current = panel.querySelector('[aria-selected="true"]') as HTMLElement | null;
      if (!current) return;
      const centerOffset =
        current.offsetTop - (panel.clientHeight / 2 - current.offsetHeight / 2);
      const maxScroll = Math.max(0, panel.scrollHeight - panel.clientHeight);
      panel.scrollTop = Math.max(0, Math.min(centerOffset, maxScroll));
    });
  }, [isOpen, value]);

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
          className={
            selectedOption ? "text-txt-primary truncate" : "text-txt-secondary truncate"
          }
        >
          {triggerText}
        </span>
        <ChevronDown
          className={`text-txt-secondary h-6 w-6 transition-transform ${
            isOpen && placement === "up" ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* BEGIN feature: portal */}
      {isOpen && !disabled && menuPortalRoot
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              className={`bg-bgc-layer2 border-bd-default fixed z-[999] overflow-y-auto rounded-xl border shadow-lg ${
                placement === "up" ? "origin-bottom" : "origin-top"
              }`}
              style={{
                left: coords.left,
                top: coords.top,
                width: coords.width,
                // 👇 [EDIT] khi hướng lên, kéo menu lên trên nút
                transform: placement === "up" ? "translateY(-100%)" : undefined,
                maxHeight:
                  placement === "up"
                    ? Math.min(320, coords.top - 8)
                    : Math.min(320, window.innerHeight - coords.top - 8),
              }}
            >
              {options.length === 0 ? (
                <div
                  role="option"
                  aria-disabled="true"
                  className="text-txt-secondary px-3 py-2.5 text-left font-sans text-base font-medium"
                >
                  Đang tải…
                </div>
              ) : (
                options.map((option) => (
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
                    {renderOptionLabel ? renderOptionLabel(option) : option.label}
                  </button>
                ))
              )}
            </div>,
            menuPortalRoot,
          )
        : null}
      {/* END feature: portal */}
    </div>
  );
}
