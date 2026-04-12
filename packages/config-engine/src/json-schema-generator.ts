// JSON Schema generator — converts ComposedSchemaEntry map to JSON Schema draft-07

import type { ComposedSchemaEntry } from "./schema-registry.js";

export interface JsonSchemaDocument {
  $schema: string;
  title: string;
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  additionalProperties: boolean;
}

export interface JsonSchemaProperty {
  type: string;
  description?: string | undefined;
  default?: unknown | undefined;
  enum?: unknown[] | undefined;
  minimum?: number | undefined;
  maximum?: number | undefined;
  "x-ghost-changePolicy"?: string | undefined;
  "x-ghost-visibility"?: string | undefined;
  "x-ghost-reloadBehavior"?: string | undefined;
  "x-ghost-namespace"?: string | undefined;
  "x-ghost-category"?: string | undefined;
}

const TYPE_MAP: Record<string, string> = {
  string: "string",
  number: "number",
  boolean: "boolean",
  object: "object",
  array: "array",
};

/**
 * Generate a single JSON Schema property from a ComposedSchemaEntry.
 */
export function generateSinglePropertySchema(
  _key: string,
  entry: ComposedSchemaEntry,
): JsonSchemaProperty {
  const { schema, ownerId } = entry;
  const prop: JsonSchemaProperty = {
    type: TYPE_MAP[schema.type] ?? "string",
  };

  if (schema.description !== undefined) {
    prop.description = schema.description;
  }
  if (schema.default !== undefined) {
    prop.default = schema.default;
  }
  if (schema.enum !== undefined) {
    prop.enum = [...schema.enum];
  }
  if (schema.minimum !== undefined) {
    prop.minimum = schema.minimum;
  }
  if (schema.maximum !== undefined) {
    prop.maximum = schema.maximum;
  }

  // x-ghost-* extension fields
  if (schema.changePolicy !== undefined) {
    prop["x-ghost-changePolicy"] = schema.changePolicy;
  }
  if (schema.visibility !== undefined) {
    prop["x-ghost-visibility"] = schema.visibility;
  }
  if (schema.reloadBehavior !== undefined) {
    prop["x-ghost-reloadBehavior"] = schema.reloadBehavior;
  }

  // Derive namespace from ownerId
  prop["x-ghost-namespace"] = ownerId;

  return prop;
}

/**
 * Generate a complete JSON Schema document from composed schemas.
 */
export function generateJsonSchema(
  schemas: Map<string, ComposedSchemaEntry>,
  options?: { title?: string | undefined },
): JsonSchemaDocument {
  const properties: Record<string, JsonSchemaProperty> = {};

  for (const [key, entry] of schemas) {
    properties[key] = generateSinglePropertySchema(key, entry);
  }

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: options?.title ?? "Ghost Configuration Schema",
    type: "object",
    properties,
    additionalProperties: false,
  };
}
