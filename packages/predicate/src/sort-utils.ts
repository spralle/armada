import { resolveSegments, validateAndSplitPath } from "./path-utils.js";

/** Compare two values for sorting: numbers numerically, strings lexicographically, Dates by epoch. */
export function compareValues(a: unknown, b: unknown): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
  if (a === undefined && b !== undefined) return -1;
  if (a !== undefined && b === undefined) return 1;
  return 0;
}

interface SortField {
  readonly segments: readonly string[];
  readonly dir: 1 | -1;
}

/** Sort items in-place by a multi-field sort specification (1 = ascending, -1 = descending). */
export function applySorting<T>(items: T[], sortSpec: Record<string, 1 | -1>): T[] {
  const fields: SortField[] = Object.entries(sortSpec).map(([field, dir]) => ({
    segments: validateAndSplitPath(field),
    dir,
  }));
  if (fields.length === 0) return items;
  return items.sort((a, b) => {
    for (const { segments, dir } of fields) {
      const va = resolveSegments(a, segments);
      const vb = resolveSegments(b, segments);
      const cmp = compareValues(va, vb) * dir;
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}
