import { describe, test, expect } from 'bun:test';
import { createJsonSchemaValidator } from '../adapters/json-schema-validator.js';
import type { JsonSchema } from '../adapters/json-schema-types.js';

/**
 * F4: Validation envelope conformance fixtures.
 * Verifies: required fields present, origin metadata correct,
 * ordering stable, dedupe works.
 */

describe('F4: Validation envelope — required fields present', () => {
  const schema: JsonSchema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
    },
    required: ['name', 'age'],
  };
  const validator = createJsonSchemaValidator(schema);

  test('every issue has code, message, severity, stage, path, source', () => {
    const issues = validator.validate({ data: {}, uiState: {}, stage: 'submit' });
    expect((issues as any).length).toBeGreaterThan(0);
    for (const i of issues as any) {
      expect(typeof i.code).toBe('string');
      expect(i.code.length).toBeGreaterThan(0);
      expect(typeof i.message).toBe('string');
      expect(i.message.length).toBeGreaterThan(0);
      expect(['error', 'warning', 'info']).toContain(i.severity);
      expect(typeof i.stage).toBe('string');
      expect(i.path).toBeDefined();
      expect(i.path.namespace).toBe('data');
      expect(Array.isArray(i.path.segments)).toBe(true);
      expect(i.source).toBeDefined();
      expect(typeof i.source.origin).toBe('string');
      expect(typeof i.source.validatorId).toBe('string');
    }
  });

  test('origin metadata is json-schema-adapter for JSON Schema validator', () => {
    const issues = validator.validate({ data: {}, uiState: {}, stage: 'submit' });
    for (const i of issues as any) {
      expect(i.source.origin).toBe('json-schema-adapter');
      expect(i.source.validatorId).toBe('json-schema-adapter');
    }
  });
});

describe('F4: Validation envelope — ordering stability', () => {
  const schema: JsonSchema = {
    type: 'object',
    properties: {
      a: { type: 'string' },
      b: { type: 'string' },
      c: { type: 'string' },
    },
    required: ['a', 'b', 'c'],
  };
  const validator = createJsonSchemaValidator(schema);

  test('same input produces same issue order across multiple runs', () => {
    const data = { data: {}, uiState: {}, stage: 'submit' as const };
    const run1 = validator.validate(data) as any;
    const run2 = validator.validate(data) as any;
    const run3 = validator.validate(data) as any;

    const key = (i: any) => i.code + ':' + i.path.segments.join('.');
    expect(run1.map(key)).toEqual(run2.map(key));
    expect(run2.map(key)).toEqual(run3.map(key));
  });
});

describe('F4: Validation envelope — dedupe', () => {
  test('duplicate issues from same validator are naturally deduped', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    };
    const validator = createJsonSchemaValidator(schema);
    const issues = validator.validate({ data: {}, uiState: {}, stage: 'submit' }) as any;

    const nameRequired = issues.filter(
      (i: any) => i.code === 'REQUIRED' && i.path.segments.includes('name'),
    );
    expect(nameRequired).toHaveLength(1);
  });

  test('type error and required error on same field are distinct', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { age: { type: 'number' } },
      required: ['age'],
    };
    const validator = createJsonSchemaValidator(schema);
    const issues = validator.validate({ data: { age: 'not-a-number' }, uiState: {}, stage: 'submit' }) as any;
    const ageCodes = issues.filter((i: any) => i.path.segments.includes('age')).map((i: any) => i.code);
    expect(ageCodes).toContain('INVALID_TYPE');
    expect(ageCodes).not.toContain('REQUIRED');
  });
});
