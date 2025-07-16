import * as Tabs from "@radix-ui/react-tabs";
import { BookOpen } from "lucide-react";

import { ProfileMangaFollow } from "~/components/profile-manga-follow";
import { ProfileMangaRecentRead } from "~/components/profile-manga-recent-read";
import { ProfileMangaUploaded } from "~/components/profile-manga-uploaded";

interface ProfileMangaManagementProps {
  userId?: string;
}

export function ProfileMangaManagement({ userId }: ProfileMangaManagementProps) {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <BookOpen className="text-lav-500 h-5 w-5" />
        <h2 className="text-xl font-semibold text-white uppercase">QUẢN LÝ TRUYỆN</h2>
      </div>

      <div className="flex flex-col gap-4">
        <Tabs.Root defaultValue="following" className="w-full">
          {/* Tab Navigation */}
          <Tabs.List className="border-bd-default flex border-b">
            <Tabs.Trigger
              value="following"
              className="data-[state=active]:border-lav-500 data-[state=active]:text-txt-primary text-txt-secondary hover:text-txt-primary flex cursor-pointer items-center gap-2.5 bg-transparent p-3 text-base font-medium transition-colors data-[state=active]:border-b-2 data-[state=active]:font-semibold"
            >
              Truyện theo dõi
            </Tabs.Trigger>
            <Tabs.Trigger
              value="recent-read"
              className="data-[state=active]:border-lav-500 data-[state=active]:text-txt-primary text-txt-secondary hover:text-txt-primary flex cursor-pointer items-center gap-2.5 bg-transparent p-3 text-base font-medium transition-colors data-[state=active]:border-b-2 data-[state=active]:font-semibold"
            >
              Đã đọc gần đây
            </Tabs.Trigger>
            <Tabs.Trigger
              value="uploaded"
              className="data-[state=active]:border-lav-500 data-[state=active]:text-txt-primary text-txt-secondary hover:text-txt-primary flex cursor-pointer items-center gap-2.5 bg-transparent p-3 text-base font-medium transition-colors data-[state=active]:border-b-2 data-[state=active]:font-semibold"
            >
              Truyện đã đăng
            </Tabs.Trigger>
          </Tabs.List>

          {/* Tab Content */}
          <Tabs.Content value="following" className="mt-4">
            <ProfileMangaFollow userId={userId} />
          </Tabs.Content>

          <Tabs.Content value="recent-read" className="mt-4">
            <ProfileMangaRecentRead userId={userId} />
          </Tabs.Content>

          <Tabs.Content value="uploaded" className="mt-4">
            <ProfileMangaUploaded userId={userId} />
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}
