module.exports = {
  apps: [
    {
      name: "ww-test1",
      script: "node",
      args: "./build/server/index.js",
      exec_mode: "fork",
      instances: 1,
      autorestart: false,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};
