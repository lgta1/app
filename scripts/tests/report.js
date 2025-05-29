// MongoDB Shell Script để insert dữ liệu test cho Report model

// Kết nối đến database (thay đổi tên database nếu cần)
use("test");

// Sample ObjectIds cho testing (có thể thay thế bằng ObjectIds thực tế từ database)
const sampleMangaIds = [
  ObjectId("64a7b1c2d3e4f5a6b7c8d9e0"),
  ObjectId("64a7b1c2d3e4f5a6b7c8d9e1"),
  ObjectId("64a7b1c2d3e4f5a6b7c8d9e2"),
  ObjectId("64a7b1c2d3e4f5a6b7c8d9e3"),
  ObjectId("64a7b1c2d3e4f5a6b7c8d9e4"),
  ObjectId("64a7b1c2d3e4f5a6b7c8d9e5"),
  ObjectId("64a7b1c2d3e4f5a6b7c8d9e6"),
  ObjectId("64a7b1c2d3e4f5a6b7c8d9e7"),
  ObjectId("64a7b1c2d3e4f5a6b7c8d9e8"),
  ObjectId("64a7b1c2d3e4f5a6b7c8d9e9"),
];

const sampleTargetIds = [
  ObjectId("64a7b1c2d3e4f5a6b7c8d9f0"),
  ObjectId("64a7b1c2d3e4f5a6b7c8d9f1"),
  ObjectId("64a7b1c2d3e4f5a6b7c8d9f2"),
  ObjectId("64a7b1c2d3e4f5a6b7c8d9f3"),
  ObjectId("64a7b1c2d3e4f5a6b7c8d9f4"),
  ObjectId("64a7b1c2d3e4f5a6b7c8d9f5"),
  ObjectId("64a7b1c2d3e4f5a6b7c8d9f6"),
  ObjectId("64a7b1c2d3e4f5a6b7c8d9f7"),
  ObjectId("64a7b1c2d3e4f5a6b7c8d9f8"),
  ObjectId("64a7b1c2d3e4f5a6b7c8d9f9"),
];

// Dữ liệu test reports (25 records)
const testReports = [
  {
    reporterName: "Nguyễn Văn A",
    targetName: "Manga One Piece",
    reason: "Nội dung không phù hợp với trẻ em",
    reportType: "MANGA",
    targetId: sampleTargetIds[0],
    mangaId: sampleMangaIds[0],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    reporterName: "Trần Thị B",
    targetName: "Comment bài viết chương 1000",
    reason: "Bình luận chứa ngôn từ thô tục",
    reportType: "COMMENT",
    targetId: sampleTargetIds[1],
    mangaId: sampleMangaIds[1],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    reporterName: "Lê Văn C",
    targetName: "Manga Naruto",
    reason: "Vi phạm bản quyền",
    reportType: "MANGA",
    targetId: sampleTargetIds[2],
    mangaId: sampleMangaIds[2],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    reporterName: "Phạm Thị D",
    targetName: "Comment spam",
    reason: "Bình luận spam, quảng cáo",
    reportType: "COMMENT",
    targetId: sampleTargetIds[3],
    mangaId: sampleMangaIds[3],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    reporterName: "Hoàng Văn E",
    targetName: "Manga Attack on Titan",
    reason: "Nội dung bạo lực quá mức",
    reportType: "MANGA",
    targetId: sampleTargetIds[4],
    mangaId: sampleMangaIds[4],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    reporterName: "Đặng Thị F",
    targetName: "Comment chính trị",
    reason: "Bình luận có nội dung chính trị nhạy cảm",
    reportType: "COMMENT",
    targetId: sampleTargetIds[0],
    mangaId: sampleMangaIds[0],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    reporterName: "Vũ Văn G",
    targetName: "Comment phân biệt chủng tộc",
    reason: "Bình luận có yếu tố phân biệt chủng tộc",
    reportType: "COMMENT",
    targetId: sampleTargetIds[1],
    mangaId: sampleMangaIds[1],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    reporterName: "Mai Thị H",
    targetName: "Manga Doraemon",
    reason: "Nội dung không phù hợp với độ tuổi",
    reportType: "MANGA",
    targetId: sampleTargetIds[2],
    mangaId: sampleMangaIds[2],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    reporterName: "Bùi Văn I",
    targetName: "Comment xúc phạm",
    reason: "Bình luận xúc phạm người khác",
    reportType: "COMMENT",
    targetId: sampleTargetIds[3],
    mangaId: sampleMangaIds[3],
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 ngày trước
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    reporterName: "Ngô Thị K",
    targetName: "Manga Dragon Ball",
    reason: "Hình ảnh không phù hợp",
    reportType: "MANGA",
    targetId: sampleTargetIds[5],
    mangaId: sampleMangaIds[5],
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 ngày trước
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    reporterName: "Đinh Văn L",
    targetName: "Comment spoiler",
    reason: "Tiết lộ nội dung truyện không đúng chỗ",
    reportType: "COMMENT",
    targetId: sampleTargetIds[6],
    mangaId: sampleMangaIds[6],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 ngày trước
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    reporterName: "Cao Thị M",
    targetName: "Manga Bleach",
    reason: "Nội dung đạo nhái",
    reportType: "MANGA",
    targetId: sampleTargetIds[7],
    mangaId: sampleMangaIds[7],
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 ngày trước
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },
  {
    reporterName: "Từ Văn N",
    targetName: "Comment fake news",
    reason: "Chia sẻ thông tin sai lệch",
    reportType: "COMMENT",
    targetId: sampleTargetIds[8],
    mangaId: sampleMangaIds[8],
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 ngày trước
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    reporterName: "Hồ Thị O",
    targetName: "Manga Tokyo Ghoul",
    reason: "Nội dung kinh dị quá mức",
    reportType: "MANGA",
    targetId: sampleTargetIds[9],
    mangaId: sampleMangaIds[9],
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 ngày trước
    updatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
  },
  {
    reporterName: "Lý Văn P",
    targetName: "Comment harassment",
    reason: "Quấy rối người dùng khác",
    reportType: "COMMENT",
    targetId: sampleTargetIds[0],
    mangaId: sampleMangaIds[0],
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 ngày trước
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    reporterName: "Tô Thị Q",
    targetName: "Manga Demon Slayer",
    reason: "Chất lượng hình ảnh kém",
    reportType: "MANGA",
    targetId: sampleTargetIds[1],
    mangaId: sampleMangaIds[1],
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 ngày trước
    updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
  },
  {
    reporterName: "Dương Văn R",
    targetName: "Comment off-topic",
    reason: "Bình luận không liên quan đến nội dung",
    reportType: "COMMENT",
    targetId: sampleTargetIds[2],
    mangaId: sampleMangaIds[2],
    createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000), // 9 ngày trước
    updatedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
  },
  {
    reporterName: "Võ Thị S",
    targetName: "Manga My Hero Academia",
    reason: "Bản dịch sai nghĩa",
    reportType: "MANGA",
    targetId: sampleTargetIds[3],
    mangaId: sampleMangaIds[3],
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 ngày trước
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  },
  {
    reporterName: "Đỗ Văn T",
    targetName: "Comment đe dọa",
    reason: "Đe dọa bạo lực đối với người khác",
    reportType: "COMMENT",
    targetId: sampleTargetIds[4],
    mangaId: sampleMangaIds[4],
    createdAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000), // 11 ngày trước
    updatedAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
  },
  {
    reporterName: "Phùng Thị U",
    targetName: "Manga Jujutsu Kaisen",
    reason: "Vi phạm quy định cộng đồng",
    reportType: "MANGA",
    targetId: sampleTargetIds[5],
    mangaId: sampleMangaIds[5],
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 ngày trước
    updatedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
  },
  {
    reporterName: "Trịnh Văn V",
    targetName: "Comment phân biệt giới tính",
    reason: "Có yếu tố phân biệt giới tính",
    reportType: "COMMENT",
    targetId: sampleTargetIds[6],
    mangaId: sampleMangaIds[6],
    createdAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000), // 13 ngày trước
    updatedAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
  },
  {
    reporterName: "Lương Thị W",
    targetName: "Manga Chainsaw Man",
    reason: "Nội dung tôn giáo nhạy cảm",
    reportType: "MANGA",
    targetId: sampleTargetIds[7],
    mangaId: sampleMangaIds[7],
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 ngày trước
    updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
  },
  {
    reporterName: "Khương Văn X",
    targetName: "Comment tự tử",
    reason: "Khuyến khích hành vi tự hại",
    reportType: "COMMENT",
    targetId: sampleTargetIds[8],
    mangaId: sampleMangaIds[8],
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 ngày trước
    updatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
  },
  {
    reporterName: "Ông Thị Y",
    targetName: "Manga Spy x Family",
    reason: "Nội dung không phù hợp với rating",
    reportType: "MANGA",
    targetId: sampleTargetIds[9],
    mangaId: sampleMangaIds[9],
    createdAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000), // 16 ngày trước
    updatedAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000),
  },
  {
    reporterName: "Ứng Văn Z",
    targetName: "Comment đạo đức giả",
    reason: "Giả mạo thông tin cá nhân",
    reportType: "COMMENT",
    targetId: sampleTargetIds[0],
    mangaId: sampleMangaIds[0],
    createdAt: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000), // 17 ngày trước
    updatedAt: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000),
  },
];

// Insert dữ liệu test
try {
  const result = db.reports.insertMany(testReports);
  print(`✅ Đã insert thành công ${result.insertedIds.length} reports test data`);
} catch (error) {
  print(`❌ Lỗi khi insert dữ liệu: ${error.message}`);
}
