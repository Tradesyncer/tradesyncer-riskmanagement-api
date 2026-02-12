import NodeCache from "node-cache";

// 1 hour TTL, check for expired keys every 10 minutes
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

export interface CachedRiskSettings {
  dailyLossAutoLiq?: number | null;
  dailyProfitAutoLiq?: number | null;
}

function riskKey(accountId: number): string {
  return `risk:${accountId}`;
}

/**
 * Get cached risk settings for an account.
 * Returns null if not cached or expired.
 */
export function getCachedRisk(accountId: number): CachedRiskSettings | null {
  return cache.get<CachedRiskSettings>(riskKey(accountId)) ?? null;
}

/**
 * Cache risk settings for an account (1 hour TTL).
 */
export function setCachedRisk(
  accountId: number,
  settings: CachedRiskSettings
): void {
  cache.set(riskKey(accountId), settings);
}

/**
 * Invalidate cached risk settings for an account.
 */
export function invalidateCachedRisk(accountId: number): void {
  cache.del(riskKey(accountId));
}

/** Get all cached entries (for debugging). */
export function getAllCached(): Record<string, unknown> {
  const keys = cache.keys();
  const entries: Record<string, unknown> = {};
  for (const key of keys) {
    const ttl = cache.getTtl(key);
    entries[key] = {
      data: cache.get(key),
      expiresIn: ttl ? Math.round((ttl - Date.now()) / 1000) + "s" : "unknown",
    };
  }
  return entries;
}
