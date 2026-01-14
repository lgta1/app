import cron from "node-cron";

import { generateSitemapsToDisk } from "@/services/sitemap-generator.server";

export const initSitemapScheduler = (): void => {
  // Chỉ chạy ở 1 instance để tránh tranh chấp ghi file.
  const isPrimaryInstance =
    process.env.SITEMAP_SCHEDULER === "1" ||
    process.env.LEADERBOARD_SCHEDULER === "1" ||
    process.env.PORT === "3001";

  if (!isPrimaryInstance) return;

  const TZ = "Asia/Ho_Chi_Minh";

  // Regenerate định kỳ để phản ánh chapter mới / truyện mới.
  // - 1 lần/giờ: đủ nhanh cho site động, nhưng không spam.
  // - Googlebot thường fetch sitemap theo lịch riêng; việc cập nhật đều giúp lastmod chính xác.
  let running = false;

  cron.schedule(
    "15 * * * *",
    async () => {
      if (running) return;
      running = true;
      try {
        const r = await generateSitemapsToDisk({
          // Default outputDir autodetects build/client (react-router-serve static dir).
          chaptersPerFile: Number(process.env.SITEMAP_CHAPTERS_PER_FILE || "10000"),
          maxUserProfiles: Number(process.env.SITEMAP_MAX_USER_PROFILES || "1000"),
        });
        console.info(`[cron] sitemap regenerated → ${r.files.length} files @ ${r.outputDir}`);
      } catch (e) {
        console.error("[cron] sitemap regenerate failed", e);
      } finally {
        running = false;
      }
    },
    { timezone: TZ },
  );
};
