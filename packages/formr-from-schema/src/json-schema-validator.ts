import type { ValidatorAdapter, ValidationIssue } from '@ghost/formr-core';
import type { CanonicalPath } from '@ghost/formr-core';
import type { JsonSchema } from './json-schema-types.js';

/** Detect if an unknown value looks like a JSON Schema object */
export function isJsonSchema(value: unknown): value is JsonSchema {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    ('type' in obj && (typeof obj['type'] === 'string' || Array.isArray(obj['type']))) ||
    ('properties' in obj && typeof obj['properties'] === 'object') ||
    ('items' in obj && typeof obj['items'] === 'object') ||
    ('enum' in obj && Array.isArray(obj['enum']))
  );
}

export function createJsonSchemaValidator<S extends string = string>(
  schema: JsonSchema,
): ValidatorAdapter<S> {
  return {
    id: 'json-schema-adapter',
    supports(s: unknown): boolean {
      return isJsonSchema(s);
    },
    validate(input) {
      const issues: ValidationIssue<S>[] = [];
      validateNode(schema, input.data, [], input.stage, issues);
      return issues;
    },
  };
}

function makePath(segments: readonly (string | number)[]): CanonicalPath {
  return { namespace: 'data', segments };
}

function makeIssue<S extends string>(
  code: string,
  message: string,
  segments: readonly (string | number)[],
  stage: S,
): ValidationIssue<S> {
  return {
    code,
    message,
    severity: 'error',
    stage,
    path: makePath(segments),
    source: { origin: 'json-schema-adapter', validatorId: 'json-schema-adapter' },
  };
}

function validateNode<S extends string>(
  schema: JsonSchema,
  data: unknown,
  segments: readonly (string | number)[],
  stage: S,
  issues: ValidationIssue<S>[],
): void {
  if (data === undefined || data === null) {
    // Required checks happen at parent level
    return;
  }

  validateType(schema, data, segments, stage, issues);
  validateEnum(schema, data, segments, stage, issues);
  validateConditional(schema, data, segments, stage, issues);
  validateDependentRequired(schema, data, segments, stage, issues);

  if (isObject(data)) {
    if (schema.required) {
      validateRequiredFields(schema, data, segments, stage, issues);
    }
    if (schema.properties) {
      validateObjectProperties(schema, data, segments, stage, issues);
    }
  }
}

function validateType<S extends string>(
  schema: JsonSchema,
  data: unknown,
  segments: readonly (string | number)[],
  stage: S,
  issues: ValidationIssue<S>[],
): void {
  const type = typeof schema.type === 'string' ? schema.type : undefined;
  if (!type) return;

  const valid = checkType(type, data);
  if (!valid) {
    issues.push(makeIssue('INVALID_TYPE', `Expected type "${type}"`, segments, stage));
  }
}

function checkType(type: string, data: unknown): boolean {
  switch (type) {
    case 'string': return typeof data === 'string';
    case 'number': case 'integer': return typeof data === 'number';
    case 'boolean': return typeof data === 'boolean';
    case 'object': return isObject(data);
    case 'array': return Array.isArray(data);
    default: return true;
  }
}

function validateEnum<S extends string>(
  schema: JsonSchema,
  data: unknown,
  segments: readonly (string | number)[],
  stage: S,
  issues: ValidationIssue<S>[],
): void {
  if (!schema.enum) return;
  if (!schema.enum.includes(data)) {
    issues.push(makeIssue('INVALID_ENUM', `Value must be one of: ${schema.enum.join(', ')}`, segments, stage));
  }
}

function validateRequiredFields<S extends string>(
  schema: JsonSchema,
  data: Record<string, unknown>,
  segments: readonly (string | number)[],
  stage: S,
  issues: ValidationIssue<S>[],
): void {
  if (!schema.required) return;
  for (const field of schema.required) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      issues.push(makeIssue('REQUIRED', `Field "${field}" is required`, [...segments, field], stage));
    }
  }
}

function validateObjectProperties<S extends string>(
  schema: JsonSchema,
  data: Record<string, unknown>,
  segments: readonly (string | number)[],
  stage: S,
  issues: ValidationIssue<S>[],
): void {
  if (!schema.properties) return;
  for (const [key, childSchema] of Object.entries(schema.properties)) {
    if (data[key] !== undefined && data[key] !== null) {
      validateNode(childSchema, data[key], [...segments, key], stage, issues);
    }
  }
}

function validateConditional<S extends string>(
  schema: JsonSchema,
  data: unknown,
  segments: readonly (string | number)[],
  stage: S,
  issues: ValidationIssue<S>[],
): void {
  if (!schema.if) return;

  const testIssues: ValidationIssue<S>[] = [];
  validateNode(schema.if, data, segments, stage, testIssues);
  const conditionMet = testIssues.length === 0;

  if (conditionMet && schema.then) {
    validateNode(schema.then, data, segments, stage, issues);
  } else if (!conditionMet && schema.else) {
    validateNode(schema.else, data, segments, stage, issues);
  }
}

function validateDependentRequired<S extends string>(
  schema: JsonSchema,
  data: unknown,
  segments: readonly (string | number)[],
  stage: S,
  issues: ValidationIssue<S>[],
): void {
  if (!schema.dependentRequired || !isObject(data)) return;

  for (const [trigger, deps] of Object.entries(schema.dependentRequired)) {
    if (data[trigger] !== undefined && data[trigger] !== null && data[trigger] !== '') {
      for (const dep of deps) {
        if (data[dep] === undefined || data[dep] === null || data[dep] === '') {
          issues.push(makeIssue(
            'DEPENDENT_REQUIRED',
            `Field "${dep}" is required when "${trigger}" is present`,
            [...segments, dep],
            stage,
          ));
        }
      }
    }
  }
}

function validateFormatDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

function validateFormatDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !isNaN(Date.parse(value));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Re-export for format validation if needed in future
export { validateFormatDate, validateFormatDateTime };
