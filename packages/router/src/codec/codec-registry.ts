import type { UrlCodecRegistry, UrlCodecStrategy } from "./codec-types.js";

/**
 * Create a URL codec registry. Follows the same pattern as PlacementStrategyRegistry.
 */
export function createUrlCodecRegistry(fallbackId: string): UrlCodecRegistry {
  const codecs = new Map<string, UrlCodecStrategy>();

  return {
    register(codec: UrlCodecStrategy): void {
      codecs.set(codec.id, codec);
    },

    get(id: string): UrlCodecStrategy | undefined {
      return codecs.get(id);
    },

    getActive(config: { codec?: string }): UrlCodecStrategy {
      const id = config.codec ?? fallbackId;
      const codec = codecs.get(id);
      if (codec) {
        return codec;
      }
      const fallback = codecs.get(fallbackId);
      if (fallback) {
        return fallback;
      }
      throw new Error(`No URL codec found for "${id}" and fallback "${fallbackId}" is not registered.`);
    },

    list(): readonly UrlCodecStrategy[] {
      return [...codecs.values()];
    },
  };
}
