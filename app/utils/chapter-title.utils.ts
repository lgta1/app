// Helper làm sạch & phân loại hiển thị tên chương
// Quy tắc:
// 1. Nhận raw (string | undefined | null). Trim.
// 2. Nếu rỗng sau trim => return { mode: 'fallback' } (dùng "Chương N").
// 3. Nếu ký tự cuối không phải số => cắt đuôi dần tới khi gặp số cuối cùng (giữ nguyên phần trước).
// 4. cleaned = kết quả trim lại.
// 5. Nếu length 1-12 => mode 'pill' + label = cleaned.
// 6. Nếu length >=13 => mode 'text' + label = truncate(cleaned, 24) với ….
// 7. Luôn trả thêm original & cleaned.

export type CleanChapterTitleResult =
  | { mode: 'fallback'; original: string; rawTrim: string; cleaned?: undefined; label?: undefined }
  | { mode: 'pill'; original: string; rawTrim: string; cleaned: string; label: string }
  | { mode: 'text'; original: string; rawTrim: string; cleaned: string; label: string };

/**
 * Thuật toán (bắt buộc theo yêu cầu):
 * B1: Trim raw -> rawTrim. Nếu rỗng => fallback.
 * B1.1: Quyết định isPill dựa vào rawTrim.length trước mọi cleaning.
 *   - 1..12 => pill
 *   - >=13 => text
 * B2: Nếu text => KHÔNG clean; truncated rawTrim tới 24 + '…' nếu dài hơn.
 * B3: Nếu pill => thực hiện cơ chế clean:
 *   - Nếu cuối là số => giữ nguyên.
 *   - Nếu cuối không phải số => tìm vị trí số cuối cùng duyệt lùi; nếu có => cắt tới đó.
 *   - Nếu không có số nào => giữ nguyên (fallback không xoá nữa).
 * B4: Sau clean, nếu cleaned.length < 3 => hoàn tác (dùng lại rawTrim).
 * B5: Trả về đối tượng kết quả theo mode.
 */
export function cleanChapterTitle(raw: string | null | undefined): CleanChapterTitleResult {
  const original = (raw ?? '').toString();
  const rawTrim = original.trim();
  if (!rawTrim) return { mode: 'fallback', original, rawTrim };

  const rawLen = rawTrim.length;
  const isPill = rawLen <= 12; // theo yêu cầu length 1..12 pill; >=13 text

  if (!isPill) {
    // TEXT MODE - không clean, chỉ truncate nếu cần
    const truncated = rawLen > 24 ? rawTrim.slice(0, 24).trimEnd() + '…' : rawTrim;
    return { mode: 'text', original, rawTrim, cleaned: rawTrim, label: truncated };
  }

  // PILL MODE - chạy cơ chế clean
  let cleaned = rawTrim;
  if (!/[0-9]$/.test(rawTrim)) {
    let i = rawTrim.length - 1;
    while (i >= 0 && !/[0-9]/.test(rawTrim[i])) i--;
    if (i >= 0 && /[0-9]/.test(rawTrim[i])) {
      cleaned = rawTrim.slice(0, i + 1).trim();
    } else {
      cleaned = rawTrim; // không có số nào: giữ nguyên
    }
  }
  if (cleaned.length < 3) {
    cleaned = rawTrim; // hoàn tác nếu quá ngắn
  }
  return { mode: 'pill', original, rawTrim, cleaned, label: cleaned };
}

// Tiny inline tests (can be executed in a test runner later)
export function _debugSampleClean() {
  return [
    'Chap 12 END',        // pill -> clean to 'Chap 12'
    'Chapter 99!!!',      // text (len>=13) -> keep raw, truncated if >24
    '  7  ',              // pill -> keep '7'
    'Ch.123abc',          // pill -> clean to 'Ch.123'
    'Vol 1 Extra',        // pill (len 11) -> last char 'a' -> clean to 'Vol 1'
    'OnlyWords',          // pill, no digits -> keep raw
    '123456789012',       // pill (12) -> keep
    '1234567890123',      // text (13) -> keep raw
    'AB',                 // pill (2) -> cleaned stays 'AB' (len<3 undo? rule says <3 revert -> rawTrim same)
    'AB!!',               // pill (4) -> clean to 'AB' then len<3? actually 2 => revert to rawTrim 'AB!!'
    null,
    undefined,
    ''
  ].map(s => ({ input: s as any, result: cleanChapterTitle(s as any) }));
}
