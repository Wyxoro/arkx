import NodeCache from "node-cache";

// 2-hour TTL for all cached API responses
const cache = new NodeCache({ stdTTL: 7200, checkperiod: 600 });

export function getCached<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

export function setCached<T>(key: string, value: T, ttl?: number): void {
  if (ttl !== undefined) {
    cache.set(key, value, ttl);
  } else {
    cache.set(key, value);
  }
}

export function deleteCached(key: string): void {
  cache.del(key);
}

export default cache;
