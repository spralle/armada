// theme-background-cache.ts — Cache-first strategy for theme background images.
//
// Uses the browser Cache API to store fetched background images locally.
// Returns blob URLs for cached content. Gracefully falls back to original
// URLs when the Cache API or fetch is unavailable.

const CACHE_NAME = "ghost-theme-backgrounds-v1";

/** Track the most recent blob URL so we can revoke it on replacement. */
let currentBlobUrl: string | null = null;

function isCacheAvailable(): boolean {
  return typeof window !== "undefined" && typeof caches !== "undefined";
}

async function openCache(): Promise<Cache | null> {
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

function createBlobUrl(response: Response): Promise<string> {
  return response.blob().then((blob) => URL.createObjectURL(blob));
}

/**
 * Revoke the previously tracked blob URL (when present) and track the new one.
 */
function trackBlobUrl(url: string): string {
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
  }
  currentBlobUrl = url;
  return url;
}

/**
 * Resolve a background image URL through the cache.
 * Returns a blob URL for cached/fetched content, or the original URL on failure.
 */
export async function resolveBackgroundUrl(url: string): Promise<string> {
  if (!isCacheAvailable()) return url;

  const cache = await openCache();
  if (!cache) return url;

  try {
    const cached = await cache.match(url);
    if (cached) {
      return trackBlobUrl(await createBlobUrl(cached));
    }

    const response = await fetch(url, { mode: "cors" });
    const clone = response.clone();
    await cache.put(url, clone);
    return trackBlobUrl(await createBlobUrl(response));
  } catch {
    return url;
  }
}

/**
 * Fire-and-forget preload: fetch and cache URLs not already stored.
 * Does not block or return results.
 */
export function preloadBackgroundUrls(urls: string[]): void {
  if (!isCacheAvailable() || urls.length === 0) return;

  void openCache().then(async (cache) => {
    if (!cache) return;
    for (const url of urls) {
      try {
        const existing = await cache.match(url);
        if (!existing) {
          const response = await fetch(url, { mode: "cors" });
          await cache.put(url, response);
        }
      } catch {
        // Silently skip failed preloads.
      }
    }
  });
}
