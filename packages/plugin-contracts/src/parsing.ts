import { z } from "zod";

import { pluginContractSchema, tenantPluginManifestResponseSchema } from "./schemas.js";
import type { PluginContract, TenantPluginManifestResponse } from "./types.js";

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

export type ParseTenantPluginManifestResult =
  | {
      success: true;
      data: TenantPluginManifestResponse;
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
      data: result.data as PluginContract,
    };
  }

  return {
    success: false,
    errors: mapValidationIssues(result.error.issues),
  };
}

export function parseTenantPluginManifest(
  input: unknown,
): ParseTenantPluginManifestResult {
  const result = tenantPluginManifestResponseSchema.safeParse(input);

  if (result.success) {
    return {
      success: true,
      data: result.data as TenantPluginManifestResponse,
    };
  }

  return {
    success: false,
    errors: mapValidationIssues(result.error.issues),
  };
}

function mapValidationIssues(issues: z.ZodIssue[]): PluginContractValidationIssue[] {
  return issues.map((issue: z.ZodIssue) => ({
    path: issue.path.map(String).join("."),
    code: issue.code,
    message: issue.message,
  }));
}
