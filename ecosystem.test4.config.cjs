module.exports = {
  apps: [
    {
      name: "ww-test4",
      script: "npm",
      args: "start",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: "production",
        PORT: "3003",
        NODE_OPTIONS: "--max-old-space-size=512", // Test NODE_OPTIONS
      },
    },
  ],
};
