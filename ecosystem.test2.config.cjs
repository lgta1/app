module.exports = {
  apps: [
    {
      name: "ww-test2",
      script: "npm",
      args: "start",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: "production",
        PORT: "3001",
      },
    },
  ],
};
