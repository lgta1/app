db.interactions.remove({});

const mangaIds = [
  "68407b3fead989219fcfeee8",
  "68407b3fead989219fcfeee9",
  "68407b3fead989219fcfeeea",
  "68407b3fead989219fcfeeeb",
  "68407b3fead989219fcfeeec",
  "68407b3fead989219fcfeeed",
  "68407b3fead989219fcfeeee",
  "68407b3fead989219fcfeeef",
  "68407b3fead989219fcfeef0",
  "68407b3fead989219fcfef19",
];

const userIds = [
  "507f1f77bcf86cd799439012",
  "507f1f77bcf86cd799439013",
  "507f1f77bcf86cd799439014",
  "507f1f77bcf86cd799439015",
  "507f1f77bcf86cd799439016",
  "507f1f77bcf86cd799439017",
  "507f1f77bcf86cd799439018",
  "507f1f77bcf86cd799439019",
  "507f1f77bcf86cd79943901a",
  "507f1f77bcf86cd79943901b",
];

function generateInteractions() {
  const interactions = [];
  const types = ["view", "like", "comment"];

  // Tạo ít nhất 100 interactions
  for (let i = 0; i < 150; i++) {
    const randomMangaId = mangaIds[Math.floor(Math.random() * mangaIds.length)];
    const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
    const randomType = types[Math.floor(Math.random() * types.length)];

    interactions.push({
      story_id: { $oid: randomMangaId },
      type: randomType,
      user_id: { $oid: randomUserId },
      created_at: new Date(),
    });
  }

  return interactions;
}

async function insertInteractions() {
  try {
    console.log("🔗 Đang kết nối tới MongoDB...");
    console.log("✅ Kết nối thành công!");

    const collection = db["interactions"];

    console.log("🎲 Đang tạo dữ liệu fake interactions...");
    const interactions = generateInteractions();

    console.log(`📥 Đang insert ${interactions.length} interactions...`);
    const result = await collection.insertMany(interactions);

    console.log(`✅ Đã insert thành công ${result.insertedCount} interactions!`);

    // Thống kê
    const stats = await collection
      .aggregate([
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    console.log("\n📊 Thống kê interactions:");
    stats.forEach((stat) => {
      console.log(`  - ${stat._id}: ${stat.count}`);
    });
  } catch (error) {
    console.error("❌ Lỗi:", error);
  } finally {
    console.log("\n🔚 Đã đóng kết nối MongoDB");
  }
}

// Chạy script
insertInteractions();
