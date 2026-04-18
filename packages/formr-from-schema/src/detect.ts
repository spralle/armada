import type { StandardSchemaV1 } from './types.js';

export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  return (
    typeof value === 'object' &&
    value !== null &&
    '~standard' in value &&
    typeof (value as Record<string, unknown>)['~standard'] === 'object'
  );
}

export function isZodSchema(schema: StandardSchemaV1): boolean {
  return schema['~standard'].vendor === 'zod';
}
