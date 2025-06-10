// MongoDB shell script để insert mock data cho Chapter collection
// Chạy với: mongosh your-database-name < chapter.js

db.chapters.insertMany([
  {
    title: "Chapter 1: Khởi đầu cuộc phiêu lưu",
    thumbnail: "https://example.com/thumbnails/chapter1.jpg",
    viewNumber: 1250,
    likeNumber: 89,
    commentNumber: 23,
    mangaId: "68407b3fead989219fcfeeef",
    createdAt: new Date("2024-01-15T08:30:00Z"),
    updatedAt: new Date("2024-01-15T08:30:00Z"),
  },
  {
    title: "Chapter 2: Gặp gỡ đồng đội",
    thumbnail: "https://example.com/thumbnails/chapter2.jpg",
    viewNumber: 980,
    likeNumber: 67,
    commentNumber: 18,
    mangaId: "68407b3fead989219fcfeeef",
    createdAt: new Date("2024-01-22T09:15:00Z"),
    updatedAt: new Date("2024-01-22T09:15:00Z"),
  },
  {
    title: "Chapter 3: Thử thách đầu tiên",
    thumbnail: "https://example.com/thumbnails/chapter3.jpg",
    viewNumber: 1450,
    likeNumber: 102,
    commentNumber: 31,
    mangaId: "68407b3fead989219fcfeeef",
    createdAt: new Date("2024-01-29T10:00:00Z"),
    updatedAt: new Date("2024-01-29T10:00:00Z"),
  },
  {
    title: "Chapter 4: Sức mạnh thức tỉnh",
    thumbnail: "https://example.com/thumbnails/chapter4.jpg",
    viewNumber: 1680,
    likeNumber: 125,
    commentNumber: 42,
    mangaId: "68407b3fead989219fcfeeef",
    createdAt: new Date("2024-02-05T11:30:00Z"),
    updatedAt: new Date("2024-02-05T11:30:00Z"),
  },
  {
    title: "Chapter 5: Trận chiến quyết định",
    thumbnail: "https://example.com/thumbnails/chapter5.jpg",
    viewNumber: 2100,
    likeNumber: 156,
    commentNumber: 58,
    mangaId: "68407b3fead989219fcfeeef",
    createdAt: new Date("2024-02-12T14:45:00Z"),
    updatedAt: new Date("2024-02-12T14:45:00Z"),
  },
]);

print(
  "✅ Đã insert thành công 5 chapter mock data với mangaId: 68407b3fead989219fcfeeef",
);
