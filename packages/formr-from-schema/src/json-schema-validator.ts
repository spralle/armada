import type { ValidatorAdapter, ValidationIssue } from '@ghost/formr-core';
import type { CanonicalPath } from '@ghost/formr-core';
import type { JsonSchema } from './json-schema-types.js';
import { dereferenceSchema } from './json-schema-deref.js';

/** Detect if an unknown value looks like a JSON Schema object */
export function isJsonSchema(value: unknown): value is JsonSchema {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  const hasSchemaMarker = '$schema' in obj;
  const hasProperties = 'properties' in obj && typeof obj['properties'] === 'object';
  const hasItems = 'items' in obj && typeof obj['items'] === 'object';
  const hasRequiredArray = 'required' in obj && Array.isArray(obj['required']);
  const hasEnum = 'enum' in obj && Array.isArray(obj['enum']);
  const hasType = 'type' in obj && (typeof obj['type'] === 'string' || Array.isArray(obj['type']));

  if (hasSchemaMarker) return true;
  if (hasProperties) return true;
  if (hasItems) return true;
  if (hasEnum) return true;
  // type alone is too broad for arbitrary strings — but known JSON Schema types are fine
  if (hasType && typeof obj['type'] === 'string') {
    const knownTypes = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'];
    if (knownTypes.includes(obj['type'] as string)) return true;
  }
  if (hasType && Array.isArray(obj['type'])) return true;

  return false;
}

export function createJsonSchemaValidator<S extends string = string>(
  rawSchema: JsonSchema,
): ValidatorAdapter<S> {
  const schema = dereferenceSchema(rawSchema);
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
  validateConst(schema, data, segments, stage, issues);
  validateEnum(schema, data, segments, stage, issues);
  validateConstraints(schema, data, segments, stage, issues);
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
  if (!schema.type) return;

  if (Array.isArray(schema.type)) {
    validateArrayType(schema.type as readonly string[], data, segments, stage, issues);
    return;
  }

  const type = schema.type as string;
  const valid = checkType(type, data);
  if (!valid) {
    issues.push(makeIssue('INVALID_TYPE', `Expected type "${type}"`, segments, stage));
  }
}

function validateArrayType<S extends string>(
  types: readonly string[],
  data: unknown,
  segments: readonly (string | number)[],
  stage: S,
  issues: ValidationIssue<S>[],
): void {
  if (data === null && types.includes('null')) return;
  const matched = types.some((t) => checkType(t, data));
  if (!matched) {
    issues.push(makeIssue('INVALID_TYPE', `Expected one of types: ${types.join(', ')}`, segments, stage));
  }
}

function checkType(type: string, data: unknown): boolean {
  switch (type) {
    case 'string': return typeof data === 'string';
    case 'number': return typeof data === 'number';
    case 'integer': return typeof data === 'number' && Number.isInteger(data);
    case 'boolean': return typeof data === 'boolean';
    case 'object': return isObject(data);
    case 'array': return Array.isArray(data);
    case 'null': return data === null;
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

function validateConst<S extends string>(
  schema: JsonSchema,
  data: unknown,
  segments: readonly (string | number)[],
  stage: S,
  issues: ValidationIssue<S>[],
): void {
  if (schema.const === undefined) return;
  if (!deepEqual(schema.const, data)) {
    issues.push(makeIssue('INVALID_CONST', `Value must equal: ${JSON.stringify(schema.const)}`, segments, stage));
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => deepEqual(aObj[k], bObj[k]));
}

function validateConstraints<S extends string>(
  schema: JsonSchema,
  data: unknown,
  segments: readonly (string | number)[],
  stage: S,
  issues: ValidationIssue<S>[],
): void {
  if (typeof data === 'number') {
    validateNumericConstraints(schema, data, segments, stage, issues);
  }
  if (typeof data === 'string') {
    validateStringConstraints(schema, data, segments, stage, issues);
  }
}

function validateNumericConstraints<S extends string>(
  schema: JsonSchema,
  value: number,
  segments: readonly (string | number)[],
  stage: S,
  issues: ValidationIssue<S>[],
): void {
  if (schema.minimum !== undefined && value < schema.minimum) {
    issues.push(makeIssue('TOO_SMALL', `Value must be >= ${schema.minimum}`, segments, stage));
  }
  if (schema.maximum !== undefined && value > schema.maximum) {
    issues.push(makeIssue('TOO_LARGE', `Value must be <= ${schema.maximum}`, segments, stage));
  }
  if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
    issues.push(makeIssue('TOO_SMALL', `Value must be > ${schema.exclusiveMinimum}`, segments, stage));
  }
  if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
    issues.push(makeIssue('TOO_LARGE', `Value must be < ${schema.exclusiveMaximum}`, segments, stage));
  }
}

function validateStringConstraints<S extends string>(
  schema: JsonSchema,
  value: string,
  segments: readonly (string | number)[],
  stage: S,
  issues: ValidationIssue<S>[],
): void {
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    issues.push(makeIssue('TOO_SHORT', `String must be at least ${schema.minLength} characters`, segments, stage));
  }
  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    issues.push(makeIssue('TOO_LONG', `String must be at most ${schema.maxLength} characters`, segments, stage));
  }
  if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
    issues.push(makeIssue('PATTERN_MISMATCH', `String must match pattern: ${schema.pattern}`, segments, stage));
  }
}

/** JSON Schema required only checks key presence, not value emptiness */
function validateRequiredFields<S extends string>(
  schema: JsonSchema,
  data: Record<string, unknown>,
  segments: readonly (string | number)[],
  stage: S,
  issues: ValidationIssue<S>[],
): void {
  if (!schema.required) return;
  for (const field of schema.required) {
    if (!(field in data) || data[field] === undefined) {
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
    if (trigger in data && data[trigger] !== undefined) {
      for (const dep of deps) {
        if (!(dep in data) || data[dep] === undefined) {
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
