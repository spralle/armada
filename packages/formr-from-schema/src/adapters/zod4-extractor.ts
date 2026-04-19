import type { SchemaFieldInfo, SchemaFieldType, SchemaIngestionResult } from '../types.js';
import { FromSchemaError } from '../errors.js';

/**
 * Zod v4 introspection interfaces. v4 replaces `_def` with a `_zod` property
 * containing `def` (schema definition) and `traits` (type markers).
 * When `_zod` is unavailable, we fall back to Standard Schema validation-only mode.
 */
interface ZodV4Internal {
  readonly _zod?: {
    readonly def?: Readonly<Record<string, unknown>>;
    readonly traits?: ReadonlySet<string> | readonly string[];
  };
}

interface ZodV4Shape {
  readonly [key: string]: unknown;
}

export function extractFromZodV4(schema: unknown): SchemaIngestionResult {
  const fields: SchemaFieldInfo[] = [];
  const metadata: Record<string, unknown> = {};

  const v4 = schema as ZodV4Internal;
  if (!v4._zod?.def) {
    // Validation-only fallback: schema conforms to Standard Schema but
    // we cannot introspect its structure without v4 internals.
    return { fields: [], metadata: { zodV4ValidationOnly: true } };
  }

  walkZodV4(schema, '', fields, true);
  return { fields, metadata };
}

function walkZodV4(
  schema: unknown,
  prefix: string,
  fields: SchemaFieldInfo[],
  required: boolean,
): void {
  const v4 = schema as ZodV4Internal;
  const def = v4._zod?.def;
  if (!def) return;

  const type = def['type'] as string | undefined;
  if (!type) return;

  if (type === 'optional') {
    walkZodV4Inner(def, 'innerType', prefix, fields, false);
    return;
  }

  if (type === 'nullable') {
    walkZodV4Inner(def, 'innerType', prefix, fields, required);
    return;
  }

  if (type === 'default') {
    walkZodV4Inner(def, 'innerType', prefix, fields, false);
    return;
  }

  if (type === 'object') {
    const shape = def['shape'] as ZodV4Shape | undefined;
    if (shape) {
      for (const [key, value] of Object.entries(shape)) {
        const childPath = prefix ? `${prefix}.${key}` : key;
        walkZodV4(value, childPath, fields, true);
      }
    }
    return;
  }

  if (type === 'array') {
    if (prefix) {
      fields.push({ path: prefix, type: 'array', required });
    }
    return;
  }

  const fieldType = mapZodV4Type(type);
  if (prefix) {
    fields.push({ path: prefix, type: fieldType, required });
  }
}

function walkZodV4Inner(
  def: Readonly<Record<string, unknown>>,
  key: string,
  prefix: string,
  fields: SchemaFieldInfo[],
  required: boolean,
): void {
  const inner = def[key];
  if (inner && typeof inner === 'object') {
    walkZodV4(inner, prefix, fields, required);
  }
}

function mapZodV4Type(type: string): SchemaFieldType {
  switch (type) {
    case 'string': return 'string';
    case 'number': case 'float32': case 'float64': return 'number';
    case 'boolean': return 'boolean';
    case 'date': return 'date';
    case 'enum': return 'enum';
    case 'union': case 'discriminatedUnion': return 'union';
    case 'array': return 'array';
    case 'object': return 'object';
    default: return 'unknown';
  }
}
