import { useEffect, useRef, useState } from "react";
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
}

export function Dropdown({
  options,
  value,
  placeholder = "Chọn một tùy chọn",
  onSelect,
  className = "",
  disabled = false,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (optionValue: string) => {
    onSelect(optionValue);
    setIsOpen(false);
  };

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`bg-bgc-layer2 border-bd-default flex w-full items-center justify-between rounded-xl border px-3 py-2.5 font-sans text-base font-medium transition-colors focus:outline-none ${
          disabled
            ? "text-txt-secondary cursor-not-allowed opacity-50"
            : "text-txt-primary focus:border-lav-500 hover:border-txt-secondary"
        } `}
      >
        <span className={selectedOption ? "text-txt-primary" : "text-txt-secondary"}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          className={`text-txt-secondary h-6 w-6 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && !disabled && (
        <div className="bg-bgc-layer2 border-bd-default absolute top-full right-0 left-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-xl border shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`w-full px-3 py-2.5 text-left font-sans text-base font-medium transition-colors first:rounded-t-xl last:rounded-b-xl ${
                value === option.value
                  ? "bg-bgc-layer-semi-purple text-txt-focus"
                  : "text-txt-primary hover:bg-bgc-layer-semi-neutral"
              } `}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
