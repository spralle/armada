import { z } from "zod";

// --- Layer and context schemas ---

export const configurationLayerSchema = z.enum([
  "core",
  "app",
  "module",
  "integrator",
  "tenant",
  "user",
  "device",
  "session",
]);

export const scopeDefinitionSchema = z.object({
  id: z.string(),
  label: z.string(),
  parentScopeId: z.string().optional(),
}).strict();

export const scopeInstanceSchema = z.object({
  scopeId: z.string(),
  value: z.string(),
}).strict();

export const tenantScopeHierarchySchema = z.object({
  scopes: z.array(scopeDefinitionSchema),
}).strict();

export const configurationContextSchema = z.object({
  tenantId: z.string(),
  scopePath: z.array(scopeInstanceSchema),
  userId: z.string(),
  deviceId: z.string(),
}).strict();

export const configurationLayerEntrySchema = z.object({
  layer: z.string(),
  entries: z.record(z.string(), z.unknown()),
}).strict();

export const configurationLayerStackSchema = z.object({
  layers: z.array(configurationLayerEntrySchema),
}).strict();

export const configurationLayerDataSchema = z.object({
  entries: z.record(z.string(), z.unknown()),
  revision: z.string().optional(),
  lastSyncedAt: z.number().optional(),
}).strict();

// --- Change policy and role schemas ---

export const configChangePolicySchema = z.enum([
  "full-pipeline",
  "staging-gate",
  "direct-allowed",
  "emergency-override",
]);

export const configurationVisibilitySchema = z.enum([
  "public",
  "admin",
  "platform",
  "internal",
]);

export const configurationRoleSchema = z.enum([
  "platform-ops",
  "tenant-admin",
  "scope-admin",
  "integrator",
  "user",
  "support",
  "system",
  "service",
  "platform-service",
]);

export const configReloadBehaviorSchema = z.enum([
  "hot",
  "restart-required",
  "rolling-restart",
]);

export const configurationPropertySchemaSchema = z.object({
  type: z.enum(["string", "number", "boolean", "object", "array"]),
  default: z.unknown().optional(),
  description: z.string().optional(),
  enum: z.array(z.unknown()).readonly().optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  expressionAllowed: z.boolean().optional(),
  changePolicy: configChangePolicySchema.optional(),
  visibility: configurationVisibilitySchema.optional(),
  sensitive: z.boolean().optional(),
  maxOverrideLayer: configurationLayerSchema.optional(),
  writeRestriction: z.array(configurationRoleSchema).readonly().optional(),
  viewConfig: z.boolean().optional(),
  instanceOverridable: z.boolean().optional(),
  reloadBehavior: configReloadBehaviorSchema.optional(),
}).strict();

// --- Expression schemas ---

export const expressionValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()).readonly().optional(),
}).strict();

// --- Session schemas ---

export const sessionModeSchema = z.enum([
  "debug",
  "god-mode",
  "preview",
  "support",
]);

export const sessionLayerMetadataSchema = z.object({
  activatedBy: z.string(),
  activatedAt: z.number(),
  reason: z.string(),
  mode: sessionModeSchema,
  expiresAt: z.number().optional(),
}).strict();

// --- Access context schemas ---

export const configurationAccessContextSchema = z.object({
  userId: z.string(),
  tenantId: z.string(),
  roles: z.array(configurationRoleSchema).readonly(),
  assignedScopes: z.array(scopeInstanceSchema).readonly().optional(),
  sessionMode: z.literal("emergency-override").optional(),
}).strict();

export const layerWriteConstraintSchema = z.object({
  scopeRestriction: z.enum(["own-tenant", "own-scope", "own-user"]).optional(),
}).strict();

export const layerWritePolicySchema = z.object({
  layer: z.string(),
  allowedRoles: z.array(configurationRoleSchema).readonly(),
  constraints: z.array(layerWriteConstraintSchema).readonly().optional(),
}).strict();

export const serviceConfigurationDeclarationSchema = z.object({
  serviceId: z.string(),
  description: z.string(),
  configuration: z.object({
    properties: z.record(z.string(), configurationPropertySchemaSchema),
  }).strict(),
  reads: z.array(z.string()).readonly().optional(),
}).strict();
