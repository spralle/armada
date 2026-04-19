import { describe, test, expect } from 'bun:test';
import { createJsonSchemaValidator, isJsonSchema } from '../json-schema-validator.js';
import { ingestSchema } from '../ingest.js';
import { extractFromZod } from '../zod-extractor.js';
import { isStandardSchema } from '../detect.js';
import { FromSchemaError } from '../errors.js';
import type { JsonSchema } from '../json-schema-types.js';

/**
 * F8: Schema adapters conformance fixtures.
 * Verifies: Standard Schema + function validators, JSON Schema adapter,
 * Zod metadata rules, x-formr rejection.
 */

describe('F8: JSON Schema adapter', () => {
  test('isJsonSchema detects valid JSON Schema objects', () => {
    expect(isJsonSchema({ type: 'object', properties: {} })).toBe(true);
    expect(isJsonSchema({ type: 'string' })).toBe(true);
    expect(isJsonSchema({ enum: ['a', 'b'] })).toBe(true);
    expect(isJsonSchema({ items: { type: 'string' } })).toBe(true);
  });

  test('isJsonSchema rejects non-schema values', () => {
    expect(isJsonSchema(null)).toBe(false);
    expect(isJsonSchema(undefined)).toBe(false);
    expect(isJsonSchema('string')).toBe(false);
    expect(isJsonSchema(42)).toBe(false);
    expect(isJsonSchema({})).toBe(false);
  });

  test('createJsonSchemaValidator produces correct adapter shape', () => {
    const schema: JsonSchema = { type: 'object', properties: { x: { type: 'string' } } };
    const adapter = createJsonSchemaValidator(schema);
    expect(adapter.id).toBe('json-schema-adapter');
    expect(typeof adapter.supports).toBe('function');
    expect(typeof adapter.validate).toBe('function');
  });

  test('adapter.supports returns true for JSON Schema', () => {
    const adapter = createJsonSchemaValidator({ type: 'object' });
    expect(adapter.supports({ type: 'object' })).toBe(true);
    expect(adapter.supports('not-a-schema')).toBe(false);
  });

  test('JSON Schema ingestion via ingestSchema', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    };
    const result = ingestSchema(schema);
    expect(result.fields.length).toBe(2);
    expect(result.fields.find((f) => f.path === 'name')?.required).toBe(true);
    expect(result.fields.find((f) => f.path === 'age')?.required).toBe(false);
  });
});

describe('F8: Standard Schema detection', () => {
  test('isStandardSchema detects Standard Schema v1 objects', () => {
    const mock = {
      '~standard': { version: 1, vendor: 'test', validate: () => ({ value: null }) },
    };
    expect(isStandardSchema(mock)).toBe(true);
  });

  test('isStandardSchema rejects non-standard objects', () => {
    expect(isStandardSchema({})).toBe(false);
    expect(isStandardSchema(null)).toBe(false);
    expect(isStandardSchema({ '~standard': 'not-object' })).toBe(false);
  });
});

describe('F8: Zod metadata rules', () => {
  test('x-formr in Zod metadata throws FORMR_ZOD_XFORMR_FORBIDDEN', () => {
    const fakeZod = {
      _def: {
        typeName: 'ZodObject',
        metadata: { 'x-formr': { widget: 'input' } },
        shape: () => ({}),
      },
    };
    try {
      extractFromZod(fakeZod);
      expect(true).toBe(false); // should not reach
    } catch (e) {
      expect(e).toBeInstanceOf(FromSchemaError);
      expect((e as FromSchemaError).code).toBe('FORMR_ZOD_XFORMR_FORBIDDEN');
    }
  });

  test('Zod formr metadata extracted correctly', () => {
    const fakeZod = {
      _def: {
        typeName: 'ZodObject',
        shape: () => ({
          name: {
            _def: {
              typeName: 'ZodString',
              metadata: { formr: { widget: 'text-input' } },
            },
          },
        }),
      },
    };
    const result = extractFromZod(fakeZod);
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].metadata).toEqual({ widget: 'text-input' });
  });
});

describe('F8: Unsupported schema rejection', () => {
  test('ingestSchema throws for unknown schema type', () => {
    expect(() => ingestSchema({ random: true })).toThrow(FromSchemaError);
  });

  test('ingestSchema returns validation-only result for non-Zod Standard Schema vendor', () => {
    const mock = {
      '~standard': { version: 1, vendor: 'valibot', validate: () => ({ value: null }) },
    };
    const result = ingestSchema(mock);
    expect(result.fields).toEqual([]);
    expect(result.metadata).toEqual({ vendor: 'valibot', validationOnly: true });
  });
});
