import type { SchemaFieldInfo, SchemaFieldType, SchemaIngestionResult } from '../types.js';
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
    const arrayFormrMeta = schema['x-formr'] as Record<string, unknown> | undefined;
    const arrayStandardMeta: Record<string, unknown> = {};
    if (schema.title !== undefined) arrayStandardMeta.title = schema.title;
    if (schema.description !== undefined) arrayStandardMeta.description = schema.description;
    if (schema.default !== undefined) arrayStandardMeta.default = schema.default;

    const arrayHasMeta = arrayFormrMeta || Object.keys(arrayStandardMeta).length > 0;
    const arrayMetadata = arrayHasMeta
      ? { ...arrayStandardMeta, ...arrayFormrMeta }
      : undefined;
    fields.push({
      path: prefix,
      type: 'array',
      required: isRequired,
      ...(arrayMetadata ? { metadata: arrayMetadata } : {}),
    });

    // Walk items properties so array-of-objects get proper child fields
    const itemSchema = schema.items;
    if (itemSchema && typeof itemSchema === 'object' && !Array.isArray(itemSchema)) {
      const items = itemSchema as JsonSchema;
      if (items.properties) {
        for (const [key, childSchema] of Object.entries(items.properties)) {
          const childPath = prefix ? `${prefix}.${key}` : key;
          walkJsonSchema(childSchema, childPath, fields, items.required, key);
        }
      }
    }

    return;
  }

  if (!prefix) return;

  const isRequired = fieldName !== undefined && parentRequired?.includes(fieldName) === true;
  const fieldType = mapJsonSchemaType(schema);

  const formrMeta = schema['x-formr'] as Record<string, unknown> | undefined;
  const standardMeta: Record<string, unknown> = {};
  if (schema.title !== undefined) standardMeta.title = schema.title;
  if (schema.description !== undefined) standardMeta.description = schema.description;
  if (schema.enum !== undefined) standardMeta.enum = schema.enum;
  if (schema.default !== undefined) standardMeta.default = schema.default;
    if (schema.minimum !== undefined) standardMeta.minimum = schema.minimum;
    if (schema.maximum !== undefined) standardMeta.maximum = schema.maximum;
    if (schema.exclusiveMinimum !== undefined) standardMeta.exclusiveMinimum = schema.exclusiveMinimum;
    if (schema.exclusiveMaximum !== undefined) standardMeta.exclusiveMaximum = schema.exclusiveMaximum;
    if (schema.minLength !== undefined) standardMeta.minLength = schema.minLength;
    if (schema.maxLength !== undefined) standardMeta.maxLength = schema.maxLength;
    if (schema.format !== undefined) standardMeta.format = schema.format;
    if (schema.pattern !== undefined) standardMeta.pattern = schema.pattern;

  const hasMeta = formrMeta || Object.keys(standardMeta).length > 0;
  const metadata = hasMeta
    ? { ...standardMeta, ...formrMeta }
    : undefined;

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
