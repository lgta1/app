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
    autorestart: true, // Tự động restart khi crash
    watch: false, // Không watch file changes
    max_memory_restart: "1G", // Restart khi dùng quá 1GB RAM
    restart_delay: 2000, // Đợi 2s trước khi restart
    max_restarts: 5, // Tối đa 5 lần restart
    min_uptime: "10s", // App phải chạy ít nhất 10s mới tính là thành công
    kill_timeout: 5000, // Timeout 5s khi kill process

    // === LOGGING (RẤT QUAN TRỌNG) ===
    error_file: `./logs/ww-${i + 1}-error.log`,
    out_file: `./logs/ww-${i + 1}-out.log`,
    log_file: `./logs/ww-${i + 1}-combined.log`,
    time: true, // Thêm timestamp vào logs
    merge_logs: true, // Gộp logs từ cluster

    // === ENVIRONMENT VARIABLES ===
    env: {
      NODE_ENV: "production",
      PORT: basePort + i, // Mỗi instance một port khác nhau

      // === CÁC ENV VARS TỪ CONFIG CŨ ===
      MINIO_ENDPOINT: "f6de453e5fe8af5525fa232b5a6f498a.r2.cloudflarestorage.com",
      MINIO_USE_SSL: "true",
      MINIO_ACCESS_KEY: "64b16b6572f535527f4a0cee30d9059f",
      MINIO_SECRET_KEY:
        "998ed84b06d72dd98502a68e19d84881bf71bb89812b1e4e5a8247087e7b4448",
      MINIO_DEFAULT_BUCKET: "vnht-images",
      MONGO_URL: "mongodb://admin:yourpassword@localhost:27017/?authSource=admin&maxPoolSize=100&minPoolSize=10&retryWrites=true&retryReads=true&w=majority&readPreference=primaryPreferred&serverSelectionTimeoutMS=5000&connectTimeoutMS=10000"
    },
  });
}

module.exports = { apps };
