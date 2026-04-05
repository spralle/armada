import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const pluginManifestIdentitySchema = z
  .object({
    id: nonEmptyString,
    name: nonEmptyString,
    version: nonEmptyString,
  })
  .strict();

export const pluginViewContributionSchema = z
  .object({
    id: nonEmptyString,
    title: nonEmptyString,
    component: nonEmptyString,
  })
  .strict();

export const pluginPartContributionSchema = z
  .object({
    id: nonEmptyString,
    title: nonEmptyString,
    slot: z.enum(["main", "secondary", "side"]),
    component: nonEmptyString,
  })
  .strict();

const pluginContributionPredicateSchema = z.record(z.string(), z.unknown());

export const pluginActionContributionSchema = z
  .object({
    id: nonEmptyString,
    title: nonEmptyString,
    intent: nonEmptyString,
    predicate: pluginContributionPredicateSchema.optional(),
  })
  .strict();

export const pluginMenuContributionSchema = z
  .object({
    menu: nonEmptyString,
    action: nonEmptyString,
    group: nonEmptyString.optional(),
    order: z.number().int().optional(),
    when: pluginContributionPredicateSchema.optional(),
  })
  .strict();

export const pluginKeybindingContributionSchema = z
  .object({
    action: nonEmptyString,
    keybinding: nonEmptyString,
    when: pluginContributionPredicateSchema.optional(),
  })
  .strict();

export const pluginSelectionContributionSchema = z
  .object({
    id: nonEmptyString,
    receiverEntityType: nonEmptyString,
    interests: z.array(
      z
        .object({
          sourceEntityType: nonEmptyString,
          adapter: nonEmptyString.optional(),
        })
        .strict(),
    ),
  })
  .strict();

export const pluginDerivedLaneContributionSchema = z
  .object({
    id: nonEmptyString,
    key: nonEmptyString,
    sourceEntityType: nonEmptyString,
    scope: z.enum(["global", "group"]),
    valueType: z.enum(["entity-id", "entity-id-list"]),
    strategy: z.enum(["priority-id", "joined-selected-ids"]),
  })
  .strict();

export const pluginDragDropSessionReferenceSchema = z
  .object({
    type: nonEmptyString,
    sessionId: nonEmptyString,
  })
  .strict();

export const pluginPopoutCapabilityFlagsSchema = z
  .object({
    allowPopout: z.boolean().optional(),
    allowMultiplePopouts: z.boolean().optional(),
  })
  .strict();

export const pluginContributionsSchema = z
  .object({
    views: z.array(pluginViewContributionSchema).optional(),
    parts: z.array(pluginPartContributionSchema).optional(),
    actions: z.array(pluginActionContributionSchema).optional(),
    menus: z.array(pluginMenuContributionSchema).optional(),
    keybindings: z.array(pluginKeybindingContributionSchema).optional(),
    selection: z.array(pluginSelectionContributionSchema).optional(),
    derivedLanes: z.array(pluginDerivedLaneContributionSchema).optional(),
    dragDropSessionReferences: z.array(pluginDragDropSessionReferenceSchema).optional(),
    popoutCapabilities: pluginPopoutCapabilityFlagsSchema.optional(),
  })
  .strict();

export const pluginContractSchema = z
  .object({
    manifest: pluginManifestIdentitySchema,
    contributes: pluginContributionsSchema.optional(),
  })
  .strict();

export const pluginCompatibilityMetadataSchema = z
  .object({
    shell: nonEmptyString,
    pluginContract: nonEmptyString,
  })
  .strict();

export const tenantPluginDescriptorSchema = z
  .object({
    id: nonEmptyString,
    version: nonEmptyString,
    entry: nonEmptyString,
    compatibility: pluginCompatibilityMetadataSchema,
  })
  .strict();

export const tenantPluginManifestResponseSchema = z
  .object({
    tenantId: nonEmptyString,
    plugins: z.array(tenantPluginDescriptorSchema),
  })
  .strict();
