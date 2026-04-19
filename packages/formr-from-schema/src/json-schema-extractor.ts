import type { SchemaFieldInfo, SchemaFieldType, SchemaIngestionResult } from './types.js';
import type { JsonSchema } from './json-schema-types.js';
import { dereferenceSchema } from './json-schema-deref.js';

export function extractFromJsonSchema(rawSchema: JsonSchema): SchemaIngestionResult {
  const schema = dereferenceSchema(rawSchema);
  const fields: SchemaFieldInfo[] = [];
  const rootMetadata: Record<string, unknown> = {};

  const rootFormr = schema['x-formr'];
  if (rootFormr) {
    Object.assign(rootMetadata, rootFormr);
  }

  walkJsonSchema(schema, '', fields);

  return { fields, metadata: rootMetadata };
}

function walkJsonSchema(
  schema: JsonSchema,
  prefix: string,
  fields: SchemaFieldInfo[],
  parentRequired?: readonly string[],
  fieldName?: string,
): void {
  const resolvedType = resolveType(schema);

  if (resolvedType === 'object' && schema.properties) {
    for (const [key, childSchema] of Object.entries(schema.properties)) {
      const childPath = prefix ? `${prefix}.${key}` : key;
      walkJsonSchema(childSchema, childPath, fields, schema.required, key);
    }
    return;
  }

  if (resolvedType === 'array') {
    const isRequired = fieldName !== undefined && parentRequired?.includes(fieldName) === true;
    const metadata = schema['x-formr'];
    fields.push({
      path: prefix,
      type: 'array',
      required: isRequired,
      ...(metadata ? { metadata } : {}),
    });
    return;
  }

  if (!prefix) return;

  const isRequired = fieldName !== undefined && parentRequired?.includes(fieldName) === true;
  const fieldType = mapJsonSchemaType(schema);
  const metadata = schema['x-formr'];

  fields.push({
    path: prefix,
    type: fieldType,
    required: isRequired,
    ...(schema.const !== undefined ? { defaultValue: schema.const } : {}),
    ...(metadata ? { metadata } : {}),
  });
}

function resolveType(schema: JsonSchema): string | undefined {
  if (typeof schema.type === 'string') return schema.type;
  if (Array.isArray(schema.type) && schema.type.length > 0) {
    const nonNull = schema.type.filter((t) => t !== 'null');
    return (nonNull.length > 0 ? nonNull[0] : schema.type[0]) as string;
  }
  if (schema.properties) return 'object';
  if (schema.items) return 'array';
  if (schema.enum) return 'enum';
  return undefined;
}

function mapJsonSchemaType(schema: JsonSchema): SchemaFieldType {
  if (schema.enum) return 'enum';
  if (schema.oneOf ?? schema.anyOf) return 'union';

  const type = resolveType(schema);
  switch (type) {
    case 'string':
      if (schema.format === 'date') return 'date';
      if (schema.format === 'date-time') return 'datetime';
      return 'string';
    case 'number':
      return 'number';
    case 'integer':
      return 'integer';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'object';
    case 'array':
      return 'array';
    default:
      return 'unknown';
  }
}
