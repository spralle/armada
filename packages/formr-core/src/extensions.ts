import { FormrError } from './errors.js';

// ADR section 11.1

export interface ExtensionManifest {
  readonly id: string;
  readonly apiVersion: string;
  readonly capabilities: readonly string[];
}

export const STABLE_CAPABILITIES = [
  'expr-engine.v1',
  'operators.v1',
  'path-resolver.v1',
  'validator-adapter.v1',
  'transform.v1',
  'middleware.v1',
] as const;

export const EXPERIMENTAL_CAPABILITIES = [
  'layout-node.exp.v1',
  'renderer.exp.v1',
] as const;

export type StableCapability = (typeof STABLE_CAPABILITIES)[number];
export type ExperimentalCapability = (typeof EXPERIMENTAL_CAPABILITIES)[number];

/**
 * Check version compatibility.
 * Stable: major version must match. Experimental: exact match required.
 */
export function isCompatibleVersion(
  declared: string,
  required: string,
  stability: 'stable' | 'experimental',
): boolean {
  if (stability === 'experimental') {
    return declared === required;
  }
  return parseMajor(declared) === parseMajor(required);
}

function parseMajor(semver: string): number {
  const match = semver.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : -1;
}

const SEMVER_BASIC = /^\d+\.\d+\.\d+/;

/** Validate manifest fields before checking capabilities. */
function validateManifestFields(manifest: ExtensionManifest): void {
  if (!manifest.id || typeof manifest.id !== 'string' || manifest.id.trim() === '') {
    throw new FormrError(
      'FORMR_EXTENSION_INVALID_MANIFEST',
      'Extension manifest requires a non-empty "id" string',
    );
  }
  if (!manifest.apiVersion || !SEMVER_BASIC.test(manifest.apiVersion)) {
    throw new FormrError(
      'FORMR_EXTENSION_INVALID_MANIFEST',
      `Extension "${manifest.id}" has invalid apiVersion "${manifest.apiVersion}" — expected semver format`,
    );
  }
  if (!Array.isArray(manifest.capabilities)) {
    throw new FormrError(
      'FORMR_EXTENSION_INVALID_MANIFEST',
      `Extension "${manifest.id}" requires a "capabilities" array`,
    );
  }
}

/** Track registered extension IDs to prevent duplicates */
const registeredExtensions = new Set<string>();

/** Clear the extension registry (for testing) */
export function clearExtensionRegistry(): void {
  registeredExtensions.clear();
}

/** Validate manifest fields, check for duplicates, and verify capability compatibility. */
export function validateExtension(
  manifest: ExtensionManifest,
  supportedCapabilities: ReadonlyMap<
    string,
    { version: string; stability: 'stable' | 'experimental' }
  >,
): void {
  validateManifestFields(manifest);

  if (registeredExtensions.has(manifest.id)) {
    throw new FormrError(
      'FORMR_EXTENSION_DUPLICATE',
      `Extension "${manifest.id}" is already registered`,
    );
  }
  registeredExtensions.add(manifest.id);

  for (const cap of manifest.capabilities) {
    const supported = supportedCapabilities.get(cap);
    if (!supported) {
      throw new FormrError(
        'FORMR_EXTENSION_INCOMPATIBLE',
        `Extension "${manifest.id}" requires unsupported capability "${cap}"`,
      );
    }
    if (
      !isCompatibleVersion(
        manifest.apiVersion,
        supported.version,
        supported.stability,
      )
    ) {
      throw new FormrError(
        'FORMR_EXTENSION_INCOMPATIBLE',
        `Extension "${manifest.id}" version ${manifest.apiVersion} incompatible with ${cap} ${supported.version} (${supported.stability})`,
      );
    }
  }
}

// ADR section 11.2 — Runtime constraints

export interface RuntimeConstraints {
  readonly validatorTimeout: number;
  readonly middlewareTimeout: number;
  readonly submitTimeout: number;
}

export const DEFAULT_RUNTIME_CONSTRAINTS: RuntimeConstraints = {
  validatorTimeout: 500,
  middlewareTimeout: 250,
  submitTimeout: 30_000,
};

/** Race a promise against a timeout, throwing FORMR_TIMEOUT on expiry. */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new FormrError('FORMR_TIMEOUT', errorMessage));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}
