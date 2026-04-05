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
  slot: "main" | "secondary" | "side";
  component: string;
}

export type PluginActionWhenPredicate = Record<string, unknown>;

export interface PluginActionContribution {
  id: string;
  title: string;
  handler: string;
  intentType: string;
  when: PluginActionWhenPredicate;
}

export interface PluginSelectionContribution {
  id: string;
  receiverEntityType: string;
  interests: PluginSelectionInterest[];
}

export interface PluginSelectionInterest {
  sourceEntityType: string;
  adapter?: string;
}

export interface PluginDerivedLaneContribution {
  id: string;
  key: string;
  sourceEntityType: string;
  scope: "global" | "group";
  valueType: "entity-id" | "entity-id-list";
  strategy: "priority-id" | "joined-selected-ids";
}

export interface PluginDragDropSessionReference {
  type: string;
  sessionId: string;
}

export interface PluginPopoutCapabilityFlags {
  allowPopout?: boolean | undefined;
  allowMultiplePopouts?: boolean | undefined;
}

export interface PluginContributions {
  views?: PluginViewContribution[] | undefined;
  parts?: PluginPartContribution[] | undefined;
  actions?: PluginActionContribution[] | undefined;
  selection?: PluginSelectionContribution[] | undefined;
  derivedLanes?: PluginDerivedLaneContribution[] | undefined;
  dragDropSessionReferences?: PluginDragDropSessionReference[] | undefined;
  popoutCapabilities?: PluginPopoutCapabilityFlags | undefined;
}

export interface PluginContract {
  manifest: PluginManifestIdentity;
  contributes?: PluginContributions | undefined;
}

export interface PluginCompatibilityMetadata {
  shell: string;
  pluginContract: string;
}

export interface TenantPluginDescriptor {
  id: string;
  version: string;
  entry: string;
  compatibility: PluginCompatibilityMetadata;
}

export interface TenantPluginManifestResponse {
  tenantId: string;
  plugins: TenantPluginDescriptor[];
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
    slot: z.enum(["main", "secondary", "side"]),
    component: nonEmptyString,
  })
  .strict();

export const pluginActionWhenPredicateSchema = z.object({}).catchall(z.unknown());

export const pluginActionContributionSchema = z
  .object({
    id: nonEmptyString,
    title: nonEmptyString,
    handler: nonEmptyString,
    intentType: nonEmptyString,
    when: pluginActionWhenPredicateSchema,
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
    selection: z.array(pluginSelectionContributionSchema).optional(),
    derivedLanes: z.array(pluginDerivedLaneContributionSchema).optional(),
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

interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

interface RangeBound {
  version: SemVer;
  inclusive: boolean;
}

interface SemVerRange {
  min?: RangeBound;
  max?: RangeBound;
}

export type CompatibilityReasonCode =
  | "INVALID_SHELL_DECLARATION"
  | "INVALID_PLUGIN_DECLARATION"
  | "MAJOR_MISMATCH"
  | "NO_COMPATIBLE_VERSION";

export type ShellPluginCompatibilityResult =
  | {
      compatible: true;
      message: string;
    }
  | {
      compatible: false;
      code: CompatibilityReasonCode;
      message: string;
    };

export function evaluateShellPluginCompatibility(
  shellDeclaration: string,
  pluginDeclaration: string,
): ShellPluginCompatibilityResult {
  const shellRangeResult = parseSemVerDeclaration(shellDeclaration);
  if (!shellRangeResult.success) {
    return {
      compatible: false,
      code: "INVALID_SHELL_DECLARATION",
      message: `Invalid shell compatibility declaration '${shellDeclaration}': ${shellRangeResult.error}`,
    };
  }

  const pluginRangeResult = parseSemVerDeclaration(pluginDeclaration);
  if (!pluginRangeResult.success) {
    return {
      compatible: false,
      code: "INVALID_PLUGIN_DECLARATION",
      message: `Invalid plugin compatibility declaration '${pluginDeclaration}': ${pluginRangeResult.error}`,
    };
  }

  const shellRange = shellRangeResult.range;
  const pluginRange = pluginRangeResult.range;

  if (rangesOverlap(shellRange, pluginRange)) {
    return {
      compatible: true,
      message:
        "Shell and plugin declarations are semver-compatible under current contract policy.",
    };
  }

  const majorMismatch = detectMajorMismatch(shellRange, pluginRange);
  if (majorMismatch) {
    return {
      compatible: false,
      code: "MAJOR_MISMATCH",
      message:
        "Incompatible major versions: shell and plugin declarations target different semver major lines.",
    };
  }

  return {
    compatible: false,
    code: "NO_COMPATIBLE_VERSION",
    message:
      "No shared semver version satisfies both shell and plugin declarations. Adjust one declaration to create overlap.",
  };
}

function parseSemVerDeclaration(
  declaration: string,
):
  | {
      success: true;
      range: SemVerRange;
    }
  | {
      success: false;
      error: string;
    } {
  const normalized = declaration.trim();
  if (!normalized) {
    return {
      success: false,
      error: "declaration cannot be empty",
    };
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return {
      success: false,
      error: "declaration cannot be empty",
    };
  }

  let combined: SemVerRange = {};
  for (const token of tokens) {
    const tokenRangeResult = parseTokenToRange(token);
    if (!tokenRangeResult.success) {
      return tokenRangeResult;
    }
    const merged = intersectRanges(combined, tokenRangeResult.range);
    if (!merged) {
      return {
        success: false,
        error: "declaration tokens cannot be satisfied together",
      };
    }
    combined = merged;
  }

  return {
    success: true,
    range: combined,
  };
}

function parseTokenToRange(
  token: string,
):
  | {
      success: true;
      range: SemVerRange;
    }
  | {
      success: false;
      error: string;
    } {
  if (token.startsWith("^")) {
    const parsed = parseSemVer(token.slice(1));
    if (!parsed) {
      return { success: false, error: `invalid caret version token '${token}'` };
    }
    const max = getCaretUpperBound(parsed);
    return {
      success: true,
      range: {
        min: { version: parsed, inclusive: true },
        max: { version: max, inclusive: false },
      },
    };
  }

  if (token.startsWith("~")) {
    const parsed = parseSemVer(token.slice(1));
    if (!parsed) {
      return { success: false, error: `invalid tilde version token '${token}'` };
    }
    const max = {
      major: parsed.major,
      minor: parsed.minor + 1,
      patch: 0,
    };
    return {
      success: true,
      range: {
        min: { version: parsed, inclusive: true },
        max: { version: max, inclusive: false },
      },
    };
  }

  const comparatorMatch = token.match(/^(>=|<=|>|<|=)(\d+\.\d+\.\d+)$/);
  if (comparatorMatch) {
    const [, operator, versionText] = comparatorMatch;
    const parsed = parseSemVer(versionText);
    if (!parsed) {
      return { success: false, error: `invalid comparator token '${token}'` };
    }
    switch (operator) {
      case ">=":
        return {
          success: true,
          range: {
            min: { version: parsed, inclusive: true },
          },
        };
      case ">":
        return {
          success: true,
          range: {
            min: { version: parsed, inclusive: false },
          },
        };
      case "<=":
        return {
          success: true,
          range: {
            max: { version: parsed, inclusive: true },
          },
        };
      case "<":
        return {
          success: true,
          range: {
            max: { version: parsed, inclusive: false },
          },
        };
      case "=":
        return {
          success: true,
          range: {
            min: { version: parsed, inclusive: true },
            max: { version: parsed, inclusive: true },
          },
        };
      default:
        return {
          success: false,
          error: `unsupported comparator token '${token}'`,
        };
    }
  }

  const exact = parseSemVer(token);
  if (exact) {
    return {
      success: true,
      range: {
        min: { version: exact, inclusive: true },
        max: { version: exact, inclusive: true },
      },
    };
  }

  return {
    success: false,
    error:
      "unsupported semver declaration format; supported: exact x.y.z, ^x.y.z, ~x.y.z, and comparator tokens",
  };
}

function parseSemVer(value: string): SemVer | null {
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function getCaretUpperBound(version: SemVer): SemVer {
  if (version.major > 0) {
    return {
      major: version.major + 1,
      minor: 0,
      patch: 0,
    };
  }
  if (version.minor > 0) {
    return {
      major: 0,
      minor: version.minor + 1,
      patch: 0,
    };
  }
  return {
    major: 0,
    minor: 0,
    patch: version.patch + 1,
  };
}

function compareSemVer(left: SemVer, right: SemVer): number {
  if (left.major !== right.major) {
    return left.major - right.major;
  }
  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }
  return left.patch - right.patch;
}

function pickLowerBound(a?: RangeBound, b?: RangeBound): RangeBound | undefined {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }

  const cmp = compareSemVer(a.version, b.version);
  if (cmp > 0) {
    return a;
  }
  if (cmp < 0) {
    return b;
  }
  return {
    version: a.version,
    inclusive: a.inclusive && b.inclusive,
  };
}

function pickUpperBound(a?: RangeBound, b?: RangeBound): RangeBound | undefined {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }

  const cmp = compareSemVer(a.version, b.version);
  if (cmp < 0) {
    return a;
  }
  if (cmp > 0) {
    return b;
  }
  return {
    version: a.version,
    inclusive: a.inclusive && b.inclusive,
  };
}

function intersectRanges(a: SemVerRange, b: SemVerRange): SemVerRange | null {
  const min = pickLowerBound(a.min, b.min);
  const max = pickUpperBound(a.max, b.max);

  if (!min || !max) {
    return createRange(min, max);
  }

  const cmp = compareSemVer(min.version, max.version);
  if (cmp < 0) {
    return createRange(min, max);
  }
  if (cmp === 0 && min.inclusive && max.inclusive) {
    return createRange(min, max);
  }
  return null;
}

function createRange(min?: RangeBound, max?: RangeBound): SemVerRange {
  const range: SemVerRange = {};
  if (min) {
    range.min = min;
  }
  if (max) {
    range.max = max;
  }
  return range;
}

function rangesOverlap(a: SemVerRange, b: SemVerRange): boolean {
  return intersectRanges(a, b) !== null;
}

function detectMajorMismatch(shellRange: SemVerRange, pluginRange: SemVerRange): boolean {
  if (!shellRange.min || !pluginRange.min) {
    return false;
  }

  return shellRange.min.version.major !== pluginRange.min.version.major;
}
