// LRU regex cache shared by filter-compiler and evaluator

const REGEX_CACHE_MAX = 256;
const regexCache = new Map<string, RegExp>();

/** Clear the regex cache (useful for testing and memory cleanup). */
export function clearRegexCache(): void {
  regexCache.clear();
}

/** Visible for testing — returns current regex cache size. */
export function getRegexCacheSize(): number {
  return regexCache.size;
}

/** Retrieve or create a cached RegExp, evicting the oldest entry if the cache is full. */
export function getCachedRegex(pattern: string, flags?: string): RegExp {
  const key = flags ? `${pattern}\0${flags}` : pattern;
  const existing = regexCache.get(key);
  if (existing) {
    regexCache.delete(key);
    regexCache.set(key, existing);
    return existing;
  }
  const re = new RegExp(pattern, flags);
  if (regexCache.size >= REGEX_CACHE_MAX) {
    const oldest = regexCache.keys().next().value;
    if (oldest !== undefined) regexCache.delete(oldest);
  }
  regexCache.set(key, re);
  return re;
}
