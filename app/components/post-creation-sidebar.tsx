import { Link } from "react-router";
import { Plus } from "lucide-react";

interface TrendingTag {
  id: string;
  name: string;
  count?: number;
}

interface PostCreationSidebarProps {
  trendingTags?: TrendingTag[];
  className?: string;
}

const defaultTrendingTags: TrendingTag[] = [
  { id: "1", name: "#Drama" },
  { id: "2", name: "#SchoolGirl" },
  { id: "3", name: "#Manga" },
];

export function PostCreationSidebar({
  trendingTags = defaultTrendingTags,
  className = "",
}: PostCreationSidebarProps) {
  return (
    <div
      className={`flex h-auto w-full max-w-[264px] flex-col items-start justify-start gap-4 p-4 pt-0 sm:max-w-full md:max-w-[264px] lg:max-w-[264px] ${className}`}
    >
      {/* Create Post Button */}
      <Link
        to="/post-create"
        className="flex items-center justify-center gap-1.5 self-stretch rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-all duration-200 hover:scale-105 active:scale-95 sm:px-3 sm:py-2 md:px-4 md:py-3"
      >
        <Plus size={20} className="text-txt-inverse" strokeWidth={2} />
        <span className="text-txt-inverse text-center font-sans text-sm leading-tight font-semibold sm:text-xs md:text-sm">
          Tạo bài đăng
        </span>
      </Link>

      {/* Trending Section */}
      <div className="flex w-full flex-col items-start justify-start gap-4">
        <div className="text-txt-secondary font-sans text-base leading-normal font-semibold sm:text-sm md:text-base">
          THỊNH HÀNH
        </div>

        {/* Trending Tags */}
        <div className="flex w-full flex-col items-start justify-start gap-4">
          {trendingTags.map((tag) => (
            <button
              key={tag.id}
              className="text-txt-primary hover:text-lav-500 cursor-pointer font-sans text-base leading-normal font-medium transition-colors duration-200 sm:text-sm md:text-base"
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PostCreationSidebar;
