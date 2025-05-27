module.exports = {
  apps: [
    {
      script: "node",
      args: "./build/server/index.js",
      name: "ww",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      restart_delay: 3000,
      max_restarts: 3,
      min_uptime: "10s",
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        NODE_OPTIONS: "--max-old-space-size=512",
      },
      error_file: "./logs/ww-error.log",
      out_file: "./logs/ww-out.log",
      log_file: "./logs/ww-combined.log",
      time: true,
    },
  ],
};
