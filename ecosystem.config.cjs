const instances = 4;           // chạy 4 tiến trình
const basePort = 3001;         // 3001, 3002

const apps = [];

for (let i = 0; i < instances; i++) {
  const isPrimary = i === 0;   // chỉ ww-1 chạy scheduler

  apps.push({
    name: `ww-${i + 1}`,
    cwd: "/home/devuser/ww-new",      // ✅ Cố định thư mục dự án
    script: "npm",                    // ✅ Chạy bằng npm
    args: "start",                    //    npm start => runner HTTP đúng
    exec_mode: "fork",

    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    restart_delay: 2000,
    max_restarts: 5,
    min_uptime: "10s",
    kill_timeout: 5000,

    error_file: `./logs/ww-${i + 1}-error.log`,
    out_file: `./logs/ww-${i + 1}-out.log`,
    log_file: `./logs/ww-${i + 1}-combined.log`,
    time: true,
    merge_logs: true,

    env: {
      NODE_ENV: "production",
      TZ: "Asia/Ho_Chi_Minh",
      PORT: basePort + i,                     // 3001 / 3002
      LEADERBOARD_SCHEDULER: isPrimary ? "1" : "0",
      HOT_CAROUSEL_SCHEDULER: isPrimary ? "1" : "0",
      INTERNAL_JOB_TOKEN: "Lequoctruong98!",

      CANONICAL_ORIGIN: "https://vinahentai.top",
      VITE_CANONICAL_ORIGIN: "https://vinahentai.top",
      CDN_BASE: "https://cdn.hoangsatruongsalacuavietnam.site",
      VITE_CDN_BASE: "https://cdn.hoangsatruongsalacuavietnam.site",

      // Legacy hosts to rewrite out of SSR payloads / stored text.
      // Update these on future migrations instead of touching code.
      LEGACY_SITE_HOSTS: "vinahentai.com,www.vinahentai.com",
      LEGACY_CDN_HOSTS: "cdn.vinahentai.com,cdn.vinahentai.xyz",
      LEGACY_SITE_HOSTS: "vinahentai.xyz,www.vinahentai.xyz,vinahentai.com,www.vinahentai.com",

      COOKIE_DOMAIN: ".vinahentai.top",

      MINIO_ENDPOINT: "f6de453e5fe8af5525fa232b5a6f498a.r2.cloudflarestorage.com",
      MINIO_USE_SSL: "true",
      MINIO_ACCESS_KEY: "64b16b6572f535527f4a0cee30d9059f",
      MINIO_SECRET_KEY: "5236b7d902ce7aed759d6ae165d9ab629e234825fa2e30cff3dc80b1583ae1c0",
      MINIO_DEFAULT_BUCKET: "vnht-images",
    },
  });
}

module.exports = { apps };
