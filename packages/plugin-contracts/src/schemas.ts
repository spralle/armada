import { z } from "zod";

import {
  partialThemePaletteSchema,
  terminalPaletteSchema,
} from "./theme-derivation.js";

const nonEmptyString = z.string().trim().min(1);

export const pluginGalleryBannerSchema = z
  .object({
    color: z.string().optional(),
    theme: z.enum(["dark", "light"]).optional(),
  })
  .strict();

export const pluginGallerySchema = z
  .object({
    screenshots: z.array(z.string()).optional(),
    banner: pluginGalleryBannerSchema.optional(),
  })
  .strict();

export const pluginManifestIdentitySchema = z
  .object({
    id: nonEmptyString,
    name: nonEmptyString,
    version: nonEmptyString,
    icon: z.string().optional(),
    gallery: pluginGallerySchema.optional(),
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
    component: nonEmptyString.optional(),
    dock: z
      .object({
        container: nonEmptyString.optional(),
        order: z.number().finite().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const pluginCapabilityComponentContributionSchema = z
  .object({
    id: nonEmptyString,
    version: nonEmptyString,
  })
  .strict();

export const pluginCapabilityServiceContributionSchema = z
  .object({
    id: nonEmptyString,
    version: nonEmptyString,
  })
  .strict();

export const pluginProvidedCapabilitiesSchema = z
  .object({
    components: z.array(pluginCapabilityComponentContributionSchema).optional(),
    services: z.array(pluginCapabilityServiceContributionSchema).optional(),
  })
  .strict();

export const pluginDependencyPluginRequirementSchema = z
  .object({
    pluginId: nonEmptyString,
    versionRange: nonEmptyString,
  })
  .strict();

export const pluginDependencyComponentRequirementSchema = z
  .object({
    id: nonEmptyString,
    versionRange: nonEmptyString,
    optional: z.boolean().optional(),
  })
  .strict();

export const pluginDependencyServiceRequirementSchema = z
  .object({
    id: nonEmptyString,
    versionRange: nonEmptyString,
    optional: z.boolean().optional(),
  })
  .strict();

export const pluginDependenciesSchema = z
  .object({
    plugins: z.array(pluginDependencyPluginRequirementSchema).optional(),
    components: z.array(pluginDependencyComponentRequirementSchema).optional(),
    services: z.array(pluginDependencyServiceRequirementSchema).optional(),
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

export const themeContributionSchema = z
  .object({
    id: nonEmptyString,
    name: nonEmptyString,
    author: z.string().optional(),
    mode: z.enum(["dark", "light"]),
    palette: partialThemePaletteSchema,
    backgrounds: z
      .array(
        z
          .object({
            url: nonEmptyString,
            mode: z.enum(["cover", "contain", "tile"]).optional(),
          })
          .strict(),
      )
      .optional(),
    fonts: z
      .object({
        body: z.string().optional(),
        mono: z.string().optional(),
        heading: z.string().optional(),
      })
      .strict()
      .optional(),
    terminal: terminalPaletteSchema.optional(),
    preview: z.string().optional(),
  })
  .strict();

export const brandingContributionSchema = z
  .object({
    appName: z.string().optional(),
    logo: z
      .object({
        light: z.string().optional(),
        dark: z.string().optional(),
      })
      .strict()
      .optional(),
    favicon: z.string().optional(),
    loadingScreen: z
      .object({
        logo: z.string().optional(),
        backgroundColor: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const activationEventsSchema = z.array(z.enum(["onStartup"]));

export const pluginContributionsSchema = z
  .object({
    views: z.array(pluginViewContributionSchema).optional(),
    parts: z.array(pluginPartContributionSchema).optional(),
    capabilities: pluginProvidedCapabilitiesSchema.optional(),
    actions: z.array(pluginActionContributionSchema).optional(),
    menus: z.array(pluginMenuContributionSchema).optional(),
    keybindings: z.array(pluginKeybindingContributionSchema).optional(),
    selection: z.array(pluginSelectionContributionSchema).optional(),
    derivedLanes: z.array(pluginDerivedLaneContributionSchema).optional(),
    dragDropSessionReferences: z.array(pluginDragDropSessionReferenceSchema).optional(),
    popoutCapabilities: pluginPopoutCapabilityFlagsSchema.optional(),
    themes: z.array(themeContributionSchema).optional(),
    branding: brandingContributionSchema.optional(),
  })
  .strict();

export const pluginContractSchema = z
  .object({
    manifest: pluginManifestIdentitySchema,
    contributes: pluginContributionsSchema.optional(),
    dependsOn: pluginDependenciesSchema.optional(),
    activationEvents: activationEventsSchema.optional(),
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
