import { PredicateError } from './errors.js';

export const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Throws PredicateError if a path segment could cause prototype pollution. */
export function assertSafeSegment(segment: string): void {
  if (DANGEROUS_KEYS.has(segment)) {
    throw new PredicateError(
      'PREDICATE_PROTOTYPE_POLLUTION',
      `Path segment "${segment}" is not allowed — potential prototype pollution`,
    );
  }
}
