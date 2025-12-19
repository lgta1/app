import * as Tabs from "@radix-ui/react-tabs";
import { BookmarkCheck, History } from "lucide-react";
import { NavLink } from "react-router-dom";

import { ProfileMangaFollow } from "~/components/profile-manga-follow";
import { ProfileMangaRecentRead } from "~/components/profile-manga-recent-read";
// Truyện đã đăng đã được tách ra thành trang /truyen-hentai/manage. Giữ component riêng để reuse.
import { ProfileMangaUploaded } from "~/components/profile-manga-uploaded";

export type ProfileStoriesTab = "following" | "recent-read";

interface ProfileMangaManagementProps {
  userId?: string;
  value?: ProfileStoriesTab;
  onValueChange?: (value: ProfileStoriesTab) => void;
}

export function ProfileMangaManagement({ userId, value, onValueChange }: ProfileMangaManagementProps) {
  const tabsProps = value
    ? {
        value,
        onValueChange: (nextValue: string) => onValueChange?.(nextValue as ProfileStoriesTab),
      }
    : { defaultValue: "following" as ProfileStoriesTab };

  return (
    <div className="flex w-full flex-col">
      <Tabs.Root {...tabsProps} className="w-full">
        {/* Tab Navigation */}
        <Tabs.List className="border-bd-default flex border-b">
          <Tabs.Trigger
            value="following"
            className="data-[state=active]:border-lav-500 data-[state=active]:text-txt-primary text-txt-secondary hover:text-txt-primary flex cursor-pointer items-center gap-2.5 bg-transparent p-3 text-base font-medium transition-colors data-[state=active]:border-b-2 data-[state=active]:font-semibold"
          >
            <BookmarkCheck className="h-4 w-4" />
            Đang theo dõi
          </Tabs.Trigger>
          <Tabs.Trigger
            value="recent-read"
            className="data-[state=active]:border-lav-500 data-[state=active]:text-txt-primary text-txt-secondary hover:text-txt-primary flex cursor-pointer items-center gap-2.5 bg-transparent p-3 text-base font-medium transition-colors data-[state=active]:border-b-2 data-[state=active]:font-semibold"
          >
            <History className="h-4 w-4" />
            Lịch sử đọc
          </Tabs.Trigger>
            {/* Truyện đã đăng được tách ra — chuyển thành NavLink tới trang quản lý riêng */}
            <NavLink
              to="/truyen-hentai/manage"
              className="text-txt-secondary hover:text-txt-primary flex items-center gap-2.5 bg-transparent p-3 text-base font-medium transition-colors"
            >
              Truyện đã đăng
            </NavLink>
        </Tabs.List>

        {/* Tab Content */}
        <Tabs.Content value="following" className="mt-4" id="saved-stories">
          <ProfileMangaFollow userId={userId} />
        </Tabs.Content>

        <Tabs.Content value="recent-read" className="mt-4" id="reading-history">
          <ProfileMangaRecentRead userId={userId} />
        </Tabs.Content>

        {/* Uploaded tab content moved to /truyen-hentai/manage. If you need to render inline, import and use ProfileMangaUploaded here. */}
      </Tabs.Root>
    </div>
  );
}
