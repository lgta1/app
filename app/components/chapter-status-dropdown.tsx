import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useFetcher } from "react-router-dom";
import { ChevronDown } from "lucide-react";

import { CHAPTER_STATUS } from "~/constants/chapter";

interface ChapterStatusDropdownProps {
  chapterId: string;
  currentStatus: number;
  mangaId: string;
  chapterNumber: number;
}

const statuses = {
  [CHAPTER_STATUS.PENDING]: {
    label: "Chờ duyệt",
    text: "text-yellow-300",
    bg: "bg-yellow-300/10",
  },
  [CHAPTER_STATUS.REJECTED]: {
    label: "Bị trả về",
    text: "text-rose-500",
    bg: "bg-rose-500/10",
  },
  [CHAPTER_STATUS.APPROVED]: {
    label: "Đã duyệt",
    text: "text-teal-400",
    bg: "bg-teal-400/10",
  },
  [CHAPTER_STATUS.SCHEDULED]: {
    label: "Hẹn giờ đăng",
    text: "text-sky-300",
    bg: "bg-sky-300/10",
  },
};

export function ChapterStatusDropdown({
  chapterId,
  currentStatus,
  mangaId,
  chapterNumber,
}: ChapterStatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fetcher = useFetcher<{ success?: boolean; message?: string; error?: string }>();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle API response
  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.success) {
        toast.success(fetcher.data.message || "Cập nhật trạng thái thành công!");
      } else if (fetcher.data.error) {
        toast.error(fetcher.data.error);
      }
    }
  }, [fetcher.data]);

  const handleStatusChange = (newStatus: number) => {
    setIsOpen(false);

    const formData = new FormData();
    formData.append("chapterId", chapterId);
    formData.append("status", newStatus.toString());
    formData.append("mangaId", mangaId);
    formData.append("chapterNumber", chapterNumber.toString());

    fetcher.submit(formData, {
      method: "POST",
      action: "/api/chapter/update-status",
    });
  };

  const currentStatusInfo = statuses[currentStatus];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`inline-flex items-center justify-center gap-2 rounded-[32px] ${currentStatusInfo?.bg} px-3 py-1.5 backdrop-blur-[3.40px] transition-opacity hover:opacity-80`}
        disabled={fetcher.state === "submitting"}
      >
        <div className={`${currentStatusInfo?.text} text-xs leading-none font-medium`}>
          {currentStatusInfo?.label}
        </div>
        <ChevronDown
          className={`h-3 w-3 ${currentStatusInfo?.text} transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="bg-bgc-layer2 border-bd-default absolute top-full left-0 z-50 mt-1 min-w-[140px] overflow-hidden rounded-lg border shadow-lg">
          {Object.entries(statuses).map(([statusValue, statusInfo]) => {
            const status = Number(statusValue);
            const isSelected = status === currentStatus;

            return (
              <button
                key={status}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleStatusChange(status);
                }}
                className={`w-full px-3 py-2 text-left text-xs font-medium transition-colors ${
                  isSelected
                    ? `${statusInfo.bg} ${statusInfo.text}`
                    : "text-txt-secondary hover:bg-bgc-layer2/80 hover:text-txt-primary"
                }`}
                disabled={fetcher.state === "submitting"}
              >
                {statusInfo.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
