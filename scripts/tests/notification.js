// MongoDB Shell Script for inserting fake notification data
// Run this script in MongoDB shell: mongosh < notification.js

// Switch to your database
use("test"); // Thay đổi tên database của bạn

// Sample user IDs (you should use real user IDs from your users collection)
const sampleUserIds = [
  "68328fd2cc1dc64a8b9fd267",
  "68328fd2cc1dc64a8b9fd268",
  "68328fd2cc1dc64a8b9fd269",
  "68328fd2cc1dc64a8b9fd26a",
  "68328fd2cc1dc64a8b9fd26b",
];

// Sample notification messages
const notificationMessages = [
  "Bạn có một manga mới được cập nhật!",
  "Chúc mừng! Bạn vừa nhận được phần thưởng từ hệ thống.",
  "Có người đã comment vào manga bạn theo dõi.",
  "Bạn đã level up! Chúc mừng bạn đạt cấp độ mới.",
  "Manga yêu thích của bạn có chapter mới.",
  "Bạn đã nhận được gold từ việc đọc manga.",
  "Có người đã like comment của bạn.",
  "Hệ thống có thông báo quan trọng cho bạn.",
  "Bạn đã hoàn thành thành tựu mới!",
  "Manga trending hiện tại đang rất hot, hãy xem ngay!",
  "Bạn có một tin nhắn mới từ admin.",
  "Waifu mới đã được thêm vào hệ thống!",
  "Sự kiện đặc biệt đang diễn ra, tham gia ngay!",
  "Bạn đã được thêm vào bảng xếp hạng.",
  "Thời gian đọc hôm nay của bạn đã đạt mục tiêu!",
];

// Generate fake notification data
const fakeNotifications = [];

// Generate 50 fake notifications
for (let i = 0; i < 50; i++) {
  const randomUserId = sampleUserIds[Math.floor(Math.random() * sampleUserIds.length)];
  const randomMessage =
    notificationMessages[Math.floor(Math.random() * notificationMessages.length)];
  const randomIsRead = Math.random() < 0.3; // 30% chance to be read

  // Generate random dates within last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const randomDate = new Date(
    thirtyDaysAgo.getTime() + Math.random() * (now.getTime() - thirtyDaysAgo.getTime()),
  );

  fakeNotifications.push({
    userId: randomUserId,
    message: randomMessage,
    isRead: randomIsRead,
    createdAt: randomDate,
    updatedAt: randomDate,
  });
}

// Insert the fake data
try {
  const result = db.notifications.insertMany(fakeNotifications);
  print(`Successfully inserted ${result.insertedIds.length} fake notifications`);

  // Show some statistics
  const totalNotifications = db.notifications.countDocuments();
  const unreadNotifications = db.notifications.countDocuments({ isRead: false });

  print(`Total notifications in database: ${totalNotifications}`);
  print(`Unread notifications: ${unreadNotifications}`);

  // Show sample of inserted data
  print("\nSample of inserted notifications:");
  db.notifications.find().limit(5).forEach(printjson);
} catch (error) {
  print("Error inserting fake notifications:", error);
}

// Create additional specific notifications for testing
const specificNotifications = [
  {
    userId: sampleUserIds[0],
    message: "Chào mừng bạn đến với hệ thống! Hãy khám phá các tính năng mới.",
    isRead: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    userId: sampleUserIds[0],
    message: "Bạn đã đọc được 100 trang manga hôm nay! Thật tuyệt vời.",
    isRead: true,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    userId: sampleUserIds[0],
    message: 'Manga "One Piece" vừa có chapter mới! Đọc ngay.',
    isRead: false,
    createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    updatedAt: new Date(Date.now() - 30 * 60 * 1000),
  },
];

try {
  const specificResult = db.notifications.insertMany(specificNotifications);
  print(`\nInserted ${specificResult.insertedIds.length} specific test notifications`);
} catch (error) {
  print("Error inserting specific notifications:", error);
}

print("\n=== Notification Test Data Generation Complete ===");
