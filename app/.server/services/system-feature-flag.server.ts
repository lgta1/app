import { SystemFeatureFlagModel } from "~/database/models/system-feature-flag.model";

type CacheEntry = { value: boolean; expiresAt: number };
const cache = new Map<string, CacheEntry>();

const now = () => Date.now();

export const getFeatureFlag = async (key: string, defaultValue: boolean): Promise<boolean> => {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now()) return cached.value;

  const doc = await SystemFeatureFlagModel.findOne({ key }).select({ enabled: 1 }).lean();
  const value = doc ? Boolean((doc as any).enabled) : defaultValue;

  cache.set(key, { value, expiresAt: now() + 5_000 });
  return value;
};

export const setFeatureFlag = async (key: string, enabled: boolean): Promise<boolean> => {
  await SystemFeatureFlagModel.updateOne({ key }, { $set: { enabled } }, { upsert: true });
  cache.set(key, { value: enabled, expiresAt: now() + 60_000 });
  return enabled;
};
