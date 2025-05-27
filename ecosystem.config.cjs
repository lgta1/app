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
      },
      error_file: "./logs/ww-error.log",
      out_file: "./logs/ww-out.log",
      log_file: "./logs/ww-combined.log",
      time: true,
    },
  ],
};
