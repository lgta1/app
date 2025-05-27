module.exports = {
  apps: [
    {
      name: "ww-test3",
      script: "npm",
      args: "start",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      restart_delay: 3000,
      max_restarts: 3,
      min_uptime: "10s",
      env: {
        NODE_ENV: "production",
        PORT: "3002",
      },
    },
  ],
};
