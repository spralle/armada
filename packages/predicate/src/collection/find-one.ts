import type { Query } from '../compile.js';
import { compileFilter } from '../filter-compiler.js';

export function findOne<T>(collection: readonly T[], query: Query): T | undefined {
  const filter = compileFilter(query);
  for (const item of collection) {
    if (filter(item as unknown as Record<string, unknown>)) {
      return item;
    }
  }
  return undefined;
}
