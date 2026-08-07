const CACHE_PREFIX = 'interactive_quiz_cache_';
const CACHE_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12 hours

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

export const SmartCache = {
  get<T>(key: string): T | null {
    const itemStr = localStorage.getItem(CACHE_PREFIX + key);
    if (!itemStr) return null;

    try {
      const item: CacheItem<T> = JSON.parse(itemStr);
      const now = Date.now();
      if (now - item.timestamp > CACHE_EXPIRY_MS) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }
      return item.data;
    } catch (e) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
  },

  set<T>(key: string, data: T): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
  },

  invalidate(key: string): void {
    localStorage.removeItem(CACHE_PREFIX + key);
  },

  invalidateAll(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  },
};
