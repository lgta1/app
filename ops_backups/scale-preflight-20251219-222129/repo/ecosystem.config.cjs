const instances = 2;           // chạy 2 tiến trình
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
      INTERNAL_JOB_TOKEN: "Lequoctruong98!",

      MINIO_ENDPOINT: "f6de453e5fe8af5525fa232b5a6f498a.r2.cloudflarestorage.com",
      MINIO_USE_SSL: "true",
      MINIO_ACCESS_KEY: "64b16b6572f535527f4a0cee30d9059f",
      MINIO_SECRET_KEY: "5236b7d902ce7aed759d6ae165d9ab629e234825fa2e30cff3dc80b1583ae1c0",
      MINIO_DEFAULT_BUCKET: "vnht-images",
    },
  });
}

module.exports = { apps };
