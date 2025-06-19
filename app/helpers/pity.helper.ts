import type { PityType } from "~/database/models/pity.model";

export const toCumulativeRates = (pity: PityType) => {
  const arr = [pity.star1, pity.star2, pity.star3, pity.star4, pity.star5];
  const cum = [];
  let sum = 0;
  for (const p of arr) {
    sum += p;
    cum.push(sum);
  }
  cum[cum.length - 1] = 100;
  return cum;
};
