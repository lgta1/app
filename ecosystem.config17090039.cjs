const instances = 2; // Số instances muốn chạy (có thể điều chỉnh)
const basePort = 3001; // Port bắt đầu

const apps = [];

for (let i = 0; i < instances; i++) {
  apps.push({
    name: `ww-${i + 1}`,
    script: "npm",
    args: "start",
    exec_mode: "fork", // Bắt buộc fork mode

    // === CÁC CẤU HÌNH QUAN TRỌNG ===
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    restart_delay: 2000,
    max_restarts: 5,
    min_uptime: "10s",
    kill_timeout: 5000,

    // === LOGGING ===
    error_file: `./logs/ww-${i + 1}-error.log`,
    out_file: `./logs/ww-${i + 1}-out.log`,
    log_file: `./logs/ww-${i + 1}-combined.log`,
    time: true,
    merge_logs: true,

    // === ENVIRONMENT VARIABLES ===
    env: {
      NODE_ENV: "production",
      PORT: basePort + i, // 3001, 3002

      // === R2 + Mongo (GIỮ NGUYÊN STRUCTURE, CHỈ ĐỔI SECRET) ===
      MINIO_ENDPOINT: "f6de453e5fe8af5525fa232b5a6f498a.r2.cloudflarestorage.com",
      MINIO_USE_SSL: "true",
      MINIO_ACCESS_KEY: "64b16b6572f535527f4a0cee30d9059f",
      MINIO_SECRET_KEY: "a126ea6952ed9c4cd3cbdf24cf5e15a8b055da07d4ff585509cf6dfa7326d547",
      MINIO_DEFAULT_BUCKET: "vnht-images",

      MONGO_URL:
        "mongodb://admin:yourpassword@localhost:27017/?authSource=admin&maxPoolSize=100&minPoolSize=10&retryWrites=true&retryReads=true&w=majority&readPreference=primaryPreferred&serverSelectionTimeoutMS=5000&connectTimeoutMS=10000",
    },
  });
}

module.exports = { apps };
