import type { SchemaFieldInfo, SchemaFieldType, SchemaIngestionResult } from '../types.js';
import { FromSchemaError } from '../errors.js';

// Zod internal types for duck-typed traversal (Zod has no formal traversal API)
interface ZodTypeDef {
  readonly typeName?: string;
  readonly description?: string;
  readonly checks?: readonly unknown[];
}

interface ZodLike {
  readonly _def?: ZodTypeDef & Record<string, unknown>;
  readonly _type?: string;
}

export function extractFromZod(schema: unknown): SchemaIngestionResult {
  const zodSchema = schema as ZodLike;
  if (!zodSchema._def) {
    throw new FromSchemaError('FORMR_SCHEMA_PARSE_FAILED', 'Schema does not appear to be a Zod schema');
  }

  const fields: SchemaFieldInfo[] = [];
  const rootMetadata: Record<string, unknown> = {};

  const rootMeta = extractFormrMetadata(zodSchema);
  if (rootMeta) {
    Object.assign(rootMetadata, rootMeta);
  }

  walkZodSchema(zodSchema, '', fields, true);

  return { fields, metadata: rootMetadata };
}

function walkZodSchema(
  schema: ZodLike,
  prefix: string,
  fields: SchemaFieldInfo[],
  required: boolean,
): void {
  const def = schema._def;
  if (!def) return;

  const typeName = def.typeName ?? '';

  if (typeName === 'ZodOptional') {
    const inner = def['innerType'] as ZodLike | undefined;
    if (inner) {
      walkZodSchema(inner, prefix, fields, false);
    }
    return;
  }

  if (typeName === 'ZodNullable') {
    const inner = def['innerType'] as ZodLike | undefined;
    if (inner) {
      walkZodSchema(inner, prefix, fields, required);
    }
    return;
  }

  if (typeName === 'ZodDefault') {
    const inner = def['innerType'] as ZodLike | undefined;
    if (inner) {
      walkZodSchema(inner, prefix, fields, false);
    }
    return;
  }

  if (typeName === 'ZodEffects') {
    const inner = def['schema'] as ZodLike | undefined;
    if (inner) {
      walkZodSchema(inner, prefix, fields, required);
    }
    return;
  }

  if (typeName === 'ZodPipeline') {
    const inner = def['in'] as ZodLike | undefined;
    if (inner) {
      walkZodSchema(inner, prefix, fields, required);
    }
    return;
  }

  if (typeName === 'ZodLazy') {
    const getter = def['getter'] as (() => ZodLike) | undefined;
    if (getter) {
      walkZodSchema(getter(), prefix, fields, required);
    }
    return;
  }

  if (typeName === 'ZodBranded') {
    const inner = def['type'] as ZodLike | undefined;
    if (inner) {
      walkZodSchema(inner, prefix, fields, required);
    }
    return;
  }

  if (typeName === 'ZodCatch') {
    const inner = def['innerType'] as ZodLike | undefined;
    if (inner) {
      walkZodSchema(inner, prefix, fields, required);
    }
    return;
  }

  if (typeName === 'ZodReadonly') {
    const inner = def['innerType'] as ZodLike | undefined;
    if (inner) {
      walkZodSchema(inner, prefix, fields, required);
    }
    return;
  }

  if (typeName === 'ZodObject') {
    const shape = def['shape'] as Record<string, ZodLike> | (() => Record<string, ZodLike>) | undefined;
    const resolvedShape = typeof shape === 'function' ? shape() : shape;
    if (resolvedShape) {
      for (const [key, value] of Object.entries(resolvedShape)) {
        const childPath = prefix ? `${prefix}.${key}` : key;
        walkZodSchema(value, childPath, fields, true);
      }
    }
    return;
  }

  if (typeName === 'ZodArray') {
    const metadata = extractFormrMetadata(schema);
    fields.push({
      path: prefix,
      type: 'array',
      required,
      ...(metadata ? { metadata } : {}),
    });
    return;
  }

  const fieldType = mapZodType(typeName);
  const metadata = extractFormrMetadata(schema);

  if (prefix) {
    fields.push({
      path: prefix,
      type: fieldType,
      required,
      ...(metadata ? { metadata } : {}),
    });
  }
}

function mapZodType(typeName: string): SchemaFieldType {
  switch (typeName) {
    case 'ZodString': return 'string';
    case 'ZodNumber': return 'number';
    case 'ZodBoolean': return 'boolean';
    case 'ZodDate': return 'date';
    case 'ZodEnum': return 'enum';
    case 'ZodUnion': case 'ZodDiscriminatedUnion': return 'union';
    case 'ZodArray': return 'array';
    case 'ZodObject': return 'object';
    default: return 'unknown';
  }
}

function extractFormrMetadata(schema: ZodLike): Readonly<Record<string, unknown>> | undefined {
  const def = schema._def;
  if (!def) return undefined;

  const rawMeta = def['metadata'] as Record<string, unknown> | undefined;
  if (rawMeta && ('x-formr' in rawMeta)) {
    throw new FromSchemaError(
      'FORMR_ZOD_XFORMR_FORBIDDEN',
      'x-formr is not allowed in Zod metadata. Use .meta({ formr: { ... } }) instead.',
    );
  }

  if (rawMeta && typeof rawMeta === 'object' && 'formr' in rawMeta) {
    return rawMeta['formr'] as Readonly<Record<string, unknown>>;
  }

  return undefined;
}
