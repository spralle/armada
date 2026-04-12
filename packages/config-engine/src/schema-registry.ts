// Schema registry — aggregation and collision detection

import type { ConfigurationPropertySchema } from "@ghost/config-types";

import { qualifyKey, validateKeyFormat } from "./namespace.js";

export interface ConfigurationSchemaDeclaration {
  ownerId: string;
  namespace: string;
  properties: Record<string, ConfigurationPropertySchema>;
}

export interface ComposedSchemaEntry {
  ownerId: string;
  fullyQualifiedKey: string;
  schema: ConfigurationPropertySchema;
}

export interface SchemaCompositionError {
  type: "duplicate-key" | "invalid-key-format";
  key: string;
  message: string;
  ownerIds?: string[] | undefined;
}

export interface ComposeResult {
  schemas: Map<string, ComposedSchemaEntry>;
  errors: SchemaCompositionError[];
}

/**
 * Composes configuration schemas from multiple declarations into a unified map.
 *
 * For each declaration, qualifies each relative key with the namespace,
 * validates key format, and detects duplicate fully-qualified keys.
 */
export function composeConfigurationSchemas(
  declarations: ConfigurationSchemaDeclaration[],
): ComposeResult {
  const schemas = new Map<string, ComposedSchemaEntry>();
  const errors: SchemaCompositionError[] = [];

  // Track owners per key for duplicate detection
  const keyOwners = new Map<string, string[]>();

  for (const declaration of declarations) {
    for (const relativeKey of Object.keys(declaration.properties)) {
      const fqKey = qualifyKey(declaration.namespace, relativeKey);

      // Validate key format
      const validation = validateKeyFormat(fqKey);
      if (!validation.valid) {
        errors.push({
          type: "invalid-key-format",
          key: fqKey,
          message: validation.error ?? `Invalid key format: ${fqKey}`,
        });
        continue;
      }

      // Track owners for duplicate detection
      const owners = keyOwners.get(fqKey);
      if (owners !== undefined) {
        owners.push(declaration.ownerId);
      } else {
        keyOwners.set(fqKey, [declaration.ownerId]);
      }

      // Only store the first declaration for each key
      if (!schemas.has(fqKey)) {
        schemas.set(fqKey, {
          ownerId: declaration.ownerId,
          fullyQualifiedKey: fqKey,
          schema: declaration.properties[relativeKey],
        });
      }
    }
  }

  // Report duplicates
  for (const [key, owners] of keyOwners) {
    if (owners.length > 1) {
      errors.push({
        type: "duplicate-key",
        key,
        message: `Duplicate configuration key "${key}" declared by: ${owners.join(", ")}`,
        ownerIds: owners,
      });
    }
  }

  return { schemas, errors };
}
