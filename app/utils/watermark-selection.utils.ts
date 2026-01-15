/**
 * Chọn index (0-based) các trang cần watermark theo quy chuẩn 7:1.
 *
 * Rule:
 * - total < 5: watermark đúng 1 trang (bất kỳ) → chọn trang giữa để ổn định.
 * - total >= 5: loại bỏ 2 trang đầu và 2 trang cuối.
 * - Số trang watermark =
 *   - total >= 7: floor(total/7)
 *   - total < 7: 1
 * - Chia đều ngay từ đầu (deterministic), không dùng rule khoảng cách tối thiểu.
 */
export function selectWatermarkIndexes(total: number): Set<number> {
  if (total <= 0) return new Set<number>();

  // total 1..4: bắt buộc 1 trang, chọn giữa cho ổn định (không random).
  if (total < 5) {
    return new Set<number>([Math.floor(total / 2)]);
  }

  const desiredCount = total >= 7 ? Math.max(1, Math.floor(total / 7)) : 1;

  // Exclude first 2 and last 2 pages.
  const validStart = 2;
  const validEnd = total - 3;
  if (validEnd < validStart) {
    return new Set<number>([Math.floor(total / 2)]);
  }

  const validLen = validEnd - validStart + 1;
  const count = Math.min(desiredCount, validLen);

  if (count <= 1) {
    return new Set<number>([Math.floor((validStart + validEnd) / 2)]);
  }

  // Evenly distribute across valid range.
  // Use rounding with monotonic fixes to guarantee uniqueness.
  const step = (validLen - 1) / (count - 1);
  const picks = new Array<number>(count);

  for (let i = 0; i < count; i++) {
    picks[i] = Math.round(validStart + i * step);
  }

  // Forward pass: ensure strictly increasing.
  for (let i = 0; i < count; i++) {
    const minAllowed = i === 0 ? validStart : picks[i - 1] + 1;
    picks[i] = Math.max(picks[i], minAllowed);
  }

  // Backward pass: ensure within end bound while staying strictly increasing.
  for (let i = count - 1; i >= 0; i--) {
    const maxAllowed = i === count - 1 ? validEnd : picks[i + 1] - 1;
    picks[i] = Math.min(picks[i], maxAllowed);
  }

  return new Set<number>(picks);
}
