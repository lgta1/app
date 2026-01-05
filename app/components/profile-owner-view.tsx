import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useLocation } from "react-router-dom";
import * as Tabs from "@radix-ui/react-tabs";
import { BookOpen, MessageCircle, Star } from "lucide-react";
import toast from "react-hot-toast";

import { ProfileInfo } from "~/components/profile-info";
import InventoryDailyReward from "~/components/inventory-daily-reward";
import { InventoryCard } from "~/components/inventory-card";
import { DialogInventorySacrifice } from "~/components/dialog-inventory-sacrifice";
import { ProfileMangaManagement, type ProfileStoriesTab } from "~/components/profile-manga-management";
import { ProfileRecentComment } from "~/components/profile-recent-comment";

 type MainTabValue = "overview" | "waifu" | "stories" | "comments";
 const DEFAULT_MAIN_TAB: MainTabValue = "overview";
 const DEFAULT_STORIES_TAB: ProfileStoriesTab = "following";

 const mapHashToTabs = (
   hash: string,
 ): { main: MainTabValue; stories: ProfileStoriesTab } | null => {
   switch (hash) {
     case "reading-history":
       return { main: "stories", stories: "recent-read" };
     case "saved-stories":
       return { main: "stories", stories: "following" };
     default:
       return null;
   }
 };

 type ProfileOwnerViewProps = {
   user: any;
 };

 export function ProfileOwnerView({ user }: ProfileOwnerViewProps) {
   const fetcher = useFetcher();
   const location = useLocation();
   const normalizedHash = (location.hash || "").replace(/^#/, "");
   const initialTabState = mapHashToTabs(normalizedHash);
   const [activeMainTab, setActiveMainTab] = useState<MainTabValue>(initialTabState?.main ?? DEFAULT_MAIN_TAB);
   const [activeStoriesTab, setActiveStoriesTab] = useState<ProfileStoriesTab>(initialTabState?.stories ?? DEFAULT_STORIES_TAB);
   const [activeIndex, setActiveIndex] = useState<number | null>(null);

   const handleUnsetWaifuRoot = () => {
     const formData = new FormData();
     formData.append("actionType", "unsetWaifu");

     fetcher.submit(formData, {
       method: "POST",
       action: "/api/user",
     });
   };

   const handleTap = (index: number) => {
     setActiveIndex(index);
     setTimeout(() => setActiveIndex(null), 1000);
   };

   useEffect(() => {
     const currentHash = (location.hash || "").replace(/^#/, "");
     const nextTabs = mapHashToTabs(currentHash);
     if (!nextTabs) {
       if (!currentHash) {
         setActiveMainTab(DEFAULT_MAIN_TAB);
         setActiveStoriesTab(DEFAULT_STORIES_TAB);
       }
       return;
     }
     setActiveMainTab(nextTabs.main);
     setActiveStoriesTab(nextTabs.stories);
   }, [location.hash, location.key]);

   const handleMainTabChange = (value: string) => {
     setActiveMainTab(value as MainTabValue);
   };

   const handleStoriesTabChange = (value: ProfileStoriesTab) => {
     setActiveStoriesTab(value);
   };

   return (
     <div className="mx-auto flex w-full max-w-[968px] flex-col items-center gap-6 p-4 lg:py-8">
       <ProfileInfo user={user} />

       <div className="w-full">
         <Tabs.Root value={activeMainTab} onValueChange={handleMainTabChange} className="w-full">
           <Tabs.List className="mb-4 flex w-full items-center gap-2 overflow-x-auto rounded-xl border border-bd-default bg-bgc-layer2 p-1">
             <Tabs.Trigger
               value="overview"
               className="data-[state=active]:bg-gradient-to-b data-[state=active]:from-[#DD94FF] data-[state=active]:to-[#D373FF] data-[state=active]:text-black text-txt-secondary rounded-lg px-3 py-2 text-sm font-semibold transition"
             >
               <span className="flex items-center gap-2"><Star className="h-4 w-4" />Tổng quan</span>
             </Tabs.Trigger>

             <Tabs.Trigger
               value="waifu"
               className="data-[state=active]:bg-gradient-to-b data-[state=active]:from-[#DD94FF] data-[state=active]:to-[#D373FF] data-[state=active]:text-black text-txt-secondary rounded-lg px-3 py-2 text-sm font-semibold transition"
             >
               <span className="flex items-center gap-2"><img src="/images/icons/multi-star.svg" alt="Icon sao" className="h-4 w-4" />Waifu</span>
             </Tabs.Trigger>

             <Tabs.Trigger
               value="stories"
               className="data-[state=active]:bg-gradient-to-b data-[state=active]:from-[#DD94FF] data-[state=active]:to-[#D373FF] data-[state=active]:text-black text-txt-secondary rounded-lg px-3 py-2 text-sm font-semibold transition"
             >
               <span className="flex items-center gap-2"><BookOpen className="h-4 w-4" />Truyện</span>
             </Tabs.Trigger>

             <Tabs.Trigger
               value="comments"
               className="data-[state=active]:bg-gradient-to-b data-[state=active]:from-[#DD94FF] data-[state=active]:to-[#D373FF] data-[state=active]:text-black text-txt-secondary rounded-lg px-3 py-2 text-sm font-semibold transition"
             >
               <span className="flex items-center gap-2"><MessageCircle className="h-4 w-4" />Bình luận</span>
             </Tabs.Trigger>
           </Tabs.List>

           <Tabs.Content value="overview" className="w-full">
             <div className="flex w-full flex-col gap-6">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <img src="/images/icons/multi-star.svg" alt="star" />
                   <h2 className="text-xl font-semibold text-white uppercase">bộ sưu tập waifu</h2>
                 </div>
               </div>

               <div className="grid w-full grid-cols-3 gap-4 lg:gap-6">
                 {(user.waifuCollection || []).slice(0, 6).map((w: any, index: number) => {
                   const isActive = activeIndex === index;
                   return (
                     <img
                       key={w.waifuId || index}
                       src={w.image}
                       alt={`Waifu ${index + 1}`}
                       onTouchStart={() => handleTap(index)}
                       onClick={() => handleTap(index)}
                       className={`aspect-2/3 w-full rounded-lg object-cover transition-all duration-300
                         ${
                           isActive
                             ? "scale-105 shadow-[0_0_12px_rgba(146,53,190,0.6)] ring-2 ring-lav-500"
                             : "hover:scale-105 hover:shadow-[0_0_12px_rgba(146,53,190,0.6)] hover:ring-2 hover:ring-lav-500"
                         }`}
                     />
                   );
                 })}
               </div>
             </div>
           </Tabs.Content>

           <Tabs.Content value="waifu" className="w-full">
             <div className="w-full">
               <InventoryDailyReward
                 className="w-full"
                 hasCurrentWaifu={!!user.currentWaifu}
                 onUnsetWaifu={handleUnsetWaifuRoot}
                 currentWaifu={user.currentWaifu}
               />

               <WaifuInventoryPanel user={user} />
             </div>
           </Tabs.Content>

           <Tabs.Content value="stories" className="w-full">
             <div className="w-full">
               <ProfileMangaManagement userId={user.id} value={activeStoriesTab} onValueChange={handleStoriesTabChange} />
             </div>
           </Tabs.Content>

           <Tabs.Content value="comments" className="w-full">
             <div className="w-full">
               <ProfileRecentComment />
             </div>
           </Tabs.Content>
         </Tabs.Root>
       </div>
     </div>
   );
 }

function WaifuInventoryPanel({ user }: any) {
   const fetcher = useFetcher();

   const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [selectedWaifu, setSelectedWaifu] = useState<any>(null);
  const [visibleCount, setVisibleCount] = useState(24);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const waifuList = useMemo(() => (Array.isArray(user.waifuCollection) ? user.waifuCollection : []), [user.waifuCollection]);
  const currentWaifuId = useMemo(() => {
    if (!user?.currentWaifu) return null;
    return typeof user.currentWaifu === "string" ? user.currentWaifu : (user.currentWaifu as any)?.id || (user.currentWaifu as any)?.waifuId;
  }, [user?.currentWaifu]);

  useEffect(() => {
    setVisibleCount(24);
  }, [waifuList.length]);

   useEffect(() => {
     if (fetcher.data) {
       if (fetcher.data.success) {
         toast.success(fetcher.data.message || "Thành công");
       } else {
         toast.error(fetcher.data.error || "Lỗi");
       }
     }
   }, [fetcher.data]);

  const getWaifuId = (waifu: any) => waifu?.waifuId || waifu?.id || waifu?._id;

  const mapWaifuToDialogFormat = (waifu: any) => {
    const waifuId = getWaifuId(waifu);

    return {
      id: waifuId,
      name: waifu.name,
      imageUrl: waifu.image,
      stars: Number(waifu.stars) || 0,
      quantity: waifu.count ?? waifu.quantity ?? 1,
      status: currentWaifuId === waifuId ? "active" : "inactive",
      expBuff: waifu.expBuff ?? 0,
      goldBuff: waifu.goldBuff ?? 0,
    };
  };

  const handleWaifuClick = (waifuId: string | null | undefined) => {
    if (!waifuId) return;
    const waifu = waifuList.find((w: any) => getWaifuId(w) === waifuId);
    if (!waifu) return;
    setSelectedWaifu(mapWaifuToDialogFormat(waifu));
    setIsDialogOpen(true);
  };

  const handleSetWaifu = (waifuId: string) => {
     if (user.currentWaifu) {
       toast.error("Bạn đã có waifu đồng hành rồi!");
       return;
     }

     const formData = new FormData();
     formData.append("actionType", "setWaifu");
     formData.append("waifuId", waifuId);

     fetcher.submit(formData, {
       method: "POST",
       action: "/api/user",
     });

     setIsDialogOpen(false);
   };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setSelectedWaifu(null);
    }
  };

  // Infinite scroll: extend visibleCount when sentinel enters viewport
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 24, waifuList.length));
        }
      });
    }, { rootMargin: "400px" });

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [waifuList.length]);

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="grid grid-cols-3 justify-items-center gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {waifuList.slice(0, visibleCount).map((waifu: any, index: number) => {
          const waifuId = getWaifuId(waifu);
          const isActive = selectedWaifu?.id === waifuId;
          const isCurrent = currentWaifuId && waifuId && currentWaifuId === waifuId;

          return (
            <InventoryCard
              key={`${waifuId || "waifu"}-${index}`}
              name={waifu.name}
              imageUrl={waifu.image}
              count={waifu.count ?? waifu.quantity ?? 1}
              status={isCurrent ? "active" : "inactive"}
              className={`transition-all duration-300 ${
                isActive ? "scale-105 shadow-[0_0_12px_rgba(146,53,190,0.6)] ring-2 ring-lav-500" : ""
              }`}
              onClick={() => handleWaifuClick(waifuId)}
            />
          );
        })}
        <div ref={sentinelRef} className="h-2 w-full" />
      </div>

      {visibleCount < waifuList.length && (
        <div className="text-center text-sm text-txt-secondary">Kéo xuống để tải thêm</div>
      )}

      {selectedWaifu && (
        <DialogInventorySacrifice
          open={isDialogOpen}
          onOpenChange={handleDialogOpenChange}
          waifu={selectedWaifu}
          onSetWaifu={() => {
            if (!selectedWaifu) return;
            handleSetWaifu(selectedWaifu.id);
          }}
        />
      )}
    </div>
  );
 }
