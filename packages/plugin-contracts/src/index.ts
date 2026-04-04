import { z } from "zod";

export interface PluginManifestIdentity {
  id: string;
  name: string;
  version: string;
}

export interface PluginViewContribution {
  id: string;
  title: string;
  component: string;
}

export interface PluginPartContribution {
  id: string;
  title: string;
  slot: "left" | "right" | "bottom";
  component: string;
}

export interface PluginCommandContribution {
  id: string;
  title: string;
  handler: string;
}

export interface PluginSelectionContribution {
  id: string;
  target: string;
}

export interface PluginDragDropSessionReference {
  type: string;
  sessionId: string;
}

export interface PluginPopoutCapabilityFlags {
  allowPopout?: boolean;
  allowMultiplePopouts?: boolean;
}

export interface PluginContributions {
  views?: PluginViewContribution[];
  parts?: PluginPartContribution[];
  commands?: PluginCommandContribution[];
  selection?: PluginSelectionContribution[];
  dragDropSessionReferences?: PluginDragDropSessionReference[];
  popoutCapabilities?: PluginPopoutCapabilityFlags;
}

export interface PluginContract {
  manifest: PluginManifestIdentity;
  contributes?: PluginContributions;
}

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
    slot: z.enum(["left", "right", "bottom"]),
    component: nonEmptyString,
  })
  .strict();

export const pluginCommandContributionSchema = z
  .object({
    id: nonEmptyString,
    title: nonEmptyString,
    handler: nonEmptyString,
  })
  .strict();

export const pluginSelectionContributionSchema = z
  .object({
    id: nonEmptyString,
    target: nonEmptyString,
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
    commands: z.array(pluginCommandContributionSchema).optional(),
    selection: z.array(pluginSelectionContributionSchema).optional(),
    dragDropSessionReferences: z
      .array(pluginDragDropSessionReferenceSchema)
      .optional(),
    popoutCapabilities: pluginPopoutCapabilityFlagsSchema.optional(),
  })
  .strict();

export const pluginContractSchema = z
  .object({
    manifest: pluginManifestIdentitySchema,
    contributes: pluginContributionsSchema.optional(),
  })
  .strict();

export interface PluginContractValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type ParsePluginContractResult =
  | {
      success: true;
      data: PluginContract;
    }
  | {
      success: false;
      errors: PluginContractValidationIssue[];
    };

export function parsePluginContract(input: unknown): ParsePluginContractResult {
  const result = pluginContractSchema.safeParse(input);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      code: issue.code,
      message: issue.message,
    })),
  };
}
