module.exports = {
  apps: [
    {
      name: "ww",
      script: "npm", // Dùng npm thay vì node
      args: "start",
      exec_mode: "cluster", // Có thể dùng cluster vì npm start hoạt động
      instances: "max", // Tăng lên 2 instances cho production
      autorestart: true,
      watch: false,
      max_memory_restart: "1G", // Tăng lên 1GB vì npm start cần nhiều memory hơn
      restart_delay: 2000,
      max_restarts: 5,
      min_uptime: "10s",
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        MINIO_ENDPOINT: "f6de453e5fe8af5525fa232b5a6f498a.r2.cloudflarestorage.com",
        MINIO_USE_SSL: "true",
        MINIO_ACCESS_KEY: "64b16b6572f535527f4a0cee30d9059f",
        MINIO_SECRET_KEY:
          "998ed84b06d72dd98502a68e19d84881bf71bb89812b1e4e5a8247087e7b4448",
        MINIO_DEFAULT_BUCKET: "vnht-images",
      },
      error_file: "./logs/ww-error.log",
      out_file: "./logs/ww-out.log",
      log_file: "./logs/ww-combined.log",
      time: true,
    },
  ],
};


