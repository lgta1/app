module.exports = {
  apps: [
    {
      script: "./build/server/index.js",
      name: "ww", // Bạn có thể thay đổi tên ứng dụng tại đây
      instances: "max", // Hoặc có thể dùng số 0, cả hai đều có nghĩa là PM2 sẽ tự động phát hiện và sử dụng tất cả các lõi CPU có sẵn.
      exec_mode: "cluster",
      autorestart: true, // Tự động khởi động lại nếu ứng dụng bị lỗi
      watch: false, // Tắt chế độ theo dõi file thay đổi trong production, thường chỉ dùng cho development
      max_memory_restart: "1G", // Khởi động lại nếu ứng dụng dùng quá 1GB RAM (tùy chỉnh theo nhu cầu)
      env: {
        NODE_ENV: "production",
        // Thêm các biến môi trường khác cho production tại đây
      },
    },
  ],
};
