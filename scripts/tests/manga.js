// MongoDB shell script to generate fake manga data
// Run with: mongo mongodb://localhost:27017/your_database_name scripts/tests/manga.js

// Clear existing data
db.mangas.remove({});

// Status options
const statusOptions = [0, 1, 2];

// Genre options
const genreOptions = [
  "big-boobs",
  "vanilla",
  "full-color",
  "ecchi",
  "schoolgirl",
  "harem",
  "incest",
  "ntr-netorare",
  "doujinshi",
  "blowjobs",
  "anal",
  "big-ass",
  "ahegao",
  "milf",
  "romance",
  "cosplay",
  "3d-hentai",
  "angel",
  "ao-dai",
  "bdsm",
  "bodysuit",
  "business-suit",
  "cheating",
  "cousin",
  "deepthroat",
  "devilgirl",
  "drama",
  "femdom",
  "action",
  "anh-dong",
  "apron",
  "big-penis",
  "breastjobs",
  "catgirls",
  "chinese-dress",
  "crotch-tattoo",
  "demon",
  "dirty",
  "elf",
  "footjob",
  "adult",
  "animal",
  "artist-cg",
  "blackmail",
  "brocon",
  "che-it",
  "comedy",
  "dark-skin",
  "demongirl",
  "dirtyoldman",
  "fantasy",
  "furry",
  "adventure",
  "animal-girl",
  "based-game",
  "body-swap",
  "brother",
  "che-nhieu",
  "comic",
  "daughter",
  "devil",
  "double-pentration",
  "father",
  "futanari",
  "loli",
  "shota",
  "con-trung",
  "guro",
];

// Vietnamese manga title components
const titlePrefixes = [
  "Đấu",
  "Tiên",
  "Võ",
  "Kiếm",
  "Thần",
  "Linh",
  "Huyền",
  "Ma",
  "Thánh",
  "Đại",
  "Siêu",
  "Tối",
  "Vĩnh",
  "Bất",
  "Tuyệt",
  "Trùng",
  "Vạn",
  "Chiến",
  "Huyết",
  "Long",
];

const titleMiddles = [
  "Phá",
  "Giả",
  "Tôn",
  "Đạo",
  "Thuật",
  "Giới",
  "Linh",
  "Tộc",
  "Vương",
  "Thần",
  "Hồn",
  "Thiên",
  "Địa",
  "Nhân",
  "Quỷ",
  "Thú",
  "Khí",
  "Sư",
  "Tướng",
  "Hải",
];

const titleSuffixes = [
  "Quyền",
  "Kiếm",
  "Đạo",
  "Giới",
  "Vực",
  "Thần",
  "Tôn",
  "Vương",
  "Đế",
  "Lục",
  "Sách",
  "Thuật",
  "Tiên",
  "Thú",
  "Linh",
  "Tâm",
  "Quyết",
  "Chiến",
  "Trận",
  "Lộ",
];

// Function to get random items from an array
function getRandomItems(array, min, max) {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Function to generate random number within range
function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Function to generate random Vietnamese manga title
function generateVietnameseTitle() {
  const usePattern = Math.random() < 0.7; // 70% chance to use pattern

  if (usePattern) {
    // Pattern: Prefix + Middle + Suffix
    const prefix = titlePrefixes[Math.floor(Math.random() * titlePrefixes.length)];
    const middle = titleMiddles[Math.floor(Math.random() * titleMiddles.length)];
    const suffix = titleSuffixes[Math.floor(Math.random() * titleSuffixes.length)];

    return `${prefix} ${middle} ${suffix}`;
  } else {
    // Random two-part title with colon
    const mainTitle =
      titlePrefixes[Math.floor(Math.random() * titlePrefixes.length)] +
      " " +
      titleMiddles[Math.floor(Math.random() * titleMiddles.length)];
    const subTitle =
      titleMiddles[Math.floor(Math.random() * titleMiddles.length)] +
      " " +
      titleSuffixes[Math.floor(Math.random() * titleSuffixes.length)];

    return `${mainTitle}: ${subTitle}`;
  }
}

// Generate 50 fake manga entries
const mangaEntries = [];

for (let i = 1; i <= 50; i++) {
  const manga = {
    title: generateVietnameseTitle(),
    description: `This is a detailed description for manga number ${i}. It contains information about the plot, characters, and setting of the manga.`,
    poster: `https://www.figma.com/file/GuSZqdyY03lwGRXGPBSI89/image/aff3025439b372163c1b109106a767fc633d068c`,
    chapters: getRandomNumber(1, 1000),
    author: `Author ${i}`,
    status: statusOptions[Math.floor(Math.random() * statusOptions.length)],
    genres: ["vanilla"],
    likeNumber: getRandomNumber(0, 10000),
    viewNumber: getRandomNumber(100, 100000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mangaEntries.push(manga);
}

// Insert the manga entries into the database
db.mangas.insertMany(mangaEntries);

// Print confirmation
print(`Successfully inserted ${mangaEntries.length} manga entries into the database.`);

// Display a sample of the inserted data
print("\nSample of inserted manga data:");
db.mangas
  .find()
  .limit(3)
  .forEach((manga) => {
    printjson(manga);
  });

// Print some statistics
print("\nDatabase statistics:");
print(`Total manga count: ${db.mangas.count()}`);
print(`Manga with 'Completed' status: ${db.mangas.count({ status: "Completed" })}`);
print(
  `Manga with more than 500 chapters: ${db.mangas.count({ chapters: { $gt: 500 } })}`,
);
print(`Manga with 'Romance' genre: ${db.mangas.count({ genres: "Romance" })}`);

// Update manga with code field starting from 99999 and decreasing
print("\nUpdating manga with code field...");

// Get all manga documents sorted by _id
const allManga = db.mangas.find().sort({ _id: 1 }).toArray();
let currentCode = 99999;

// Update each manga with decreasing code
allManga.forEach((manga) => {
  db.mangas.updateOne({ _id: manga._id }, { $set: { code: currentCode } });
  currentCode--;
});

print(`Successfully updated ${allManga.length} manga entries with code field.`);
print(`Code range: ${99999 - allManga.length + 1} to 99999`);

// Display sample of updated data
print("\nSample of updated manga data with code:");
db.mangas
  .find({}, { title: 1, code: 1, _id: 0 })
  .limit(5)
  .sort({ code: -1 })
  .forEach((manga) => {
    printjson(manga);
  });
