// MongoDB Shell Script for inserting fake notification data
// Run this script in MongoDB shell: mongosh < notification.js

// Switch to your database
use("test"); // Thay đổi tên database của bạn

db.notifications.drop();

// Sample user IDs (you should use real user IDs from your users collection)
const sampleUserIds = [
  "68328fd2cc1dc64a8b9fd267",
  "68328fd2cc1dc64a8b9fd268",
  "68328fd2cc1dc64a8b9fd269",
  "68328fd2cc1dc64a8b9fd26a",
  "68328fd2cc1dc64a8b9fd26b",
];

// Sample notification data
const notificationTitles = [
  "Manga mới cập nhật!",
  "Phần thưởng đã sẵn sàng!",
  "Comment mới",
  "Level Up!",
  "Chapter mới",
  "Nhận được Gold",
  "Like mới",
  "Thông báo hệ thống",
  "Thành tựu mới!",
  "Manga trending",
  "Tin nhắn Admin",
  "Waifu mới",
  "Sự kiện đặc biệt",
  "Bảng xếp hạng",
  "Mục tiêu đạt được",
];

const notificationSubtitles = [
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

const sampleImages = ["https://placehold.co/34x34"];

// Generate fake notification data
const fakeNotifications = [];

// Generate 50 fake notifications
for (let i = 0; i < 50; i++) {
  const randomUserId = sampleUserIds[Math.floor(Math.random() * sampleUserIds.length)];
  const randomTitle =
    notificationTitles[Math.floor(Math.random() * notificationTitles.length)];
  const randomSubtitle =
    notificationSubtitles[Math.floor(Math.random() * notificationSubtitles.length)];
  const randomImgUrl = sampleImages[Math.floor(Math.random() * sampleImages.length)];
  const randomIsRead = Math.random() < 0.3; // 30% chance to be read

  fakeNotifications.push({
    userId: randomUserId,
    title: randomTitle,
    subtitle: randomSubtitle,
    imgUrl: randomImgUrl,
    isRead: randomIsRead,
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
    userId: "68328fd2cc1dc64a8b9fd267",
    title: "Chào mừng!",
    subtitle: "Chào mừng bạn đến với hệ thống! Hãy khám phá các tính năng mới.",
    imgUrl: "https://placehold.co/34x34",
    isRead: false,
  },
  {
    userId: "68328fd2cc1dc64a8b9fd267",
    title: "Thành tích đọc",
    subtitle: "Bạn đã đọc được 100 trang manga hôm nay! Thật tuyệt vời.",
    imgUrl: "https://placehold.co/34x34",
    isRead: true,
  },
  {
    userId: "68328fd2cc1dc64a8b9fd267",
    title: "Chapter mới",
    subtitle: 'Manga "One Piece" vừa có chapter mới! Đọc ngay.',
    imgUrl: "https://placehold.co/34x34",
    isRead: false,
  },
];

try {
  const specificResult = db.notifications.insertMany(specificNotifications);
  print(`\nInserted ${specificResult.insertedIds.length} specific test notifications`);
} catch (error) {
  print("Error inserting specific notifications:", error);
}

print("\n=== Notification Test Data Generation Complete ===");
