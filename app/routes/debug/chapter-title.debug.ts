// Script debug edge cases cho cleanChapterTitle
// Chạy bằng: node ./app/debug/chapter-title.debug.ts (transpile trước nếu cần)
// Vì project là type: module, dùng import
import { cleanChapterTitle, _debugSampleClean } from "../utils/chapter-title.utils";

const samples = [
  "Chap 12 END",
  "Chapter 99!!!",
  "  7  ",
  "Ch.123abc",
  "Vol 1 Extra",
  "OnlyWords",
  "123456789012",
  "1234567890123",
  "AB",
  "AB!!",
  "   ",
  null,
  undefined,
  "Chapter 12345678901234567890 ABCXYZTAIL",
];

console.table(
  samples.map((s) => {
    const r = cleanChapterTitle(s as any);
    return {
      input: String(s),
      mode: r.mode,
      rawTrim: r.rawTrim,
      cleaned: (r as any).cleaned ?? "-",
      label: (r as any).label ?? "-",
      rawLen: (String(s ?? "").trim()).length,
      cleanedLen: (r as any).cleaned ? (r as any).cleaned.length : 0,
    };
  })
);

// Extra internal samples utility
console.log("\n_internal _debugSampleClean():");
console.dir(_debugSampleClean(), { depth: null });
