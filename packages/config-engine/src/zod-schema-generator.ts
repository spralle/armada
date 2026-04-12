// Zod schema generator — produces TypeScript source strings from ComposedSchemaEntry

import type { ComposedSchemaEntry } from "./schema-registry.js";

/**
 * Converts a dot-delimited config key to a valid JS identifier.
 * Replaces dots and hyphens with underscores.
 */
export function sanitizeKeyToIdentifier(key: string): string {
  return key.replace(/[.\-]/g, "_");
}

/**
 * Generate a Zod expression string for a single config property.
 */
export function generateZodForProperty(
  _key: string,
  entry: ComposedSchemaEntry,
): string {
  const { schema } = entry;
  const parts: string[] = [];

  // Handle string enums specially — z.enum([...]) instead of z.string()
  if (schema.type === "string" && schema.enum !== undefined && schema.enum.length > 0) {
    const enumValues = schema.enum.map((v) => JSON.stringify(v)).join(", ");
    parts.push(`z.enum([${enumValues}])`);
  } else {
    // Base type
    switch (schema.type) {
      case "number":
        parts.push("z.number()");
        break;
      case "boolean":
        parts.push("z.boolean()");
        break;
      case "object":
        parts.push("z.record(z.string(), z.unknown())");
        break;
      case "array":
        parts.push("z.array(z.unknown())");
        break;
      default:
        parts.push("z.string()");
        break;
    }
  }

  // Chain constraints for number types
  if (schema.type === "number") {
    if (schema.minimum !== undefined) {
      parts.push(`.min(${schema.minimum})`);
    }
    if (schema.maximum !== undefined) {
      parts.push(`.max(${schema.maximum})`);
    }
  }

  // Default value
  if (schema.default !== undefined) {
    parts.push(`.default(${JSON.stringify(schema.default)})`);
  }

  return parts.join("");
}

/**
 * Generate a complete TypeScript source file with Zod schema definitions.
 */
export function generateZodSchemaSource(
  schemas: Map<string, ComposedSchemaEntry>,
): string {
  const lines: string[] = [];

  lines.push('import { z } from "zod";');
  lines.push("");

  const entries: Array<{ identifier: string; key: string; expression: string }> = [];

  for (const [key, entry] of schemas) {
    const identifier = sanitizeKeyToIdentifier(key);
    const expression = generateZodForProperty(key, entry);
    entries.push({ identifier, key, expression });
    lines.push(`export const ${identifier} = ${expression};`);
  }

  lines.push("");
  lines.push("export const configSchemas = {");
  for (const { identifier, key } of entries) {
    lines.push(`  ${JSON.stringify(key)}: ${identifier},`);
  }
  lines.push("} as const;");
  lines.push("");

  return lines.join("\n");
}
