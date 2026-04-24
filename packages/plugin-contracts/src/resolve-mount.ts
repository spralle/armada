/**
 * Generic module mount function resolution.
 * Extracts a mount function from a loaded module by checking well-known
 * property names in a configurable order. Used by vanilla-dom-renderer,
 * part-mount-resolution, and surface-mount-utils to avoid duplicating
 * the same resolution algorithm.
 */

/** Options controlling which properties the resolver inspects. */
export interface ResolveMountOptions {
  /** Top-level function property names to check first (e.g. "mountPart", "mountSurface"). */
  readonly topLevelNames: readonly string[];
  /** Collection property name containing keyed entries (e.g. "parts", "surfaces"). */
  readonly collectionName?: string;
  /** Keys to look up inside the collection, tried in order. */
  readonly collectionKeys?: readonly string[];
  /** Whether to check `module.default` as a final fallback. */
  readonly checkDefault?: boolean;
}

/**
 * Resolve a mount function from a module object.
 *
 * Resolution order:
 * 1. Top-level named exports (e.g. `module.mountPart`)
 * 2. Collection entries by key (e.g. `module.parts[partId]` or `.mount` on it)
 * 3. `module.default` (if enabled)
 *
 * Returns the resolved function or undefined.
 */
export function resolveModuleMountFn(
  moduleValue: unknown,
  options: ResolveMountOptions,
): ((...args: unknown[]) => unknown) | undefined {
  if (typeof moduleValue !== "object" || moduleValue === null) {
    return undefined;
  }

  const record = moduleValue as Record<string, unknown>;

  // 1. Top-level named exports
  for (const name of options.topLevelNames) {
    if (typeof record[name] === "function") {
      return record[name] as (...args: unknown[]) => unknown;
    }
  }

  // 2. Collection lookup
  if (options.collectionName && options.collectionKeys) {
    const collection = record[options.collectionName];
    if (typeof collection === "object" && collection !== null) {
      const collectionRecord = collection as Record<string, unknown>;
      for (const key of options.collectionKeys) {
        if (!key) continue;
        const candidate = collectionRecord[key];
        const resolved = resolveCandidate(candidate);
        if (resolved) return resolved;
      }
    }
  }

  // 3. Default fallback
  if (options.checkDefault !== false) {
    return resolveCandidate(record.default);
  }

  return undefined;
}

/** Resolve a candidate value: if it's a function return it, if it has .mount return that. */
function resolveCandidate(
  candidate: unknown,
): ((...args: unknown[]) => unknown) | undefined {
  if (typeof candidate === "function") {
    return candidate as (...args: unknown[]) => unknown;
  }
  if (typeof candidate === "object" && candidate !== null) {
    const mount = (candidate as Record<string, unknown>).mount;
    if (typeof mount === "function") {
      return mount as (...args: unknown[]) => unknown;
    }
  }
  return undefined;
}
