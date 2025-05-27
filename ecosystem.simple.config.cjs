module.exports = {
  apps: [
    {
      name: "ww",
      script: "npm",
      args: "start",
      exec_mode: "fork",
      instances: 1,
      autorestart: false, // Tắt autorestart để debug
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};
