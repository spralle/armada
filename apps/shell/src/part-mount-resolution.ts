/**
 * Part mount resolution utilities — resolves mount functions from remote modules.
 * Extracted from part-module-host for cohesion and file size.
 */

import type { ComposedShellPart } from "./ui/parts-rendering.js";
import type { ShellRuntime } from "./app/types.js";
import { type MountCleanup, toRecord } from "./federation-mount-utils.js";

export type MountPartFn = (
  target: HTMLElement,
  context: {
    part: ComposedShellPart;
    instanceId: string;
    definitionId: string;
    args: Record<string, string>;
    runtime: ShellRuntime;
  },
) => MountCleanup | Promise<MountCleanup>;

export function resolvePartMount(moduleValue: unknown, part: ComposedShellPart): MountPartFn | null {
  const moduleRecord = toRecord(moduleValue);
  if (!moduleRecord) {
    return null;
  }

  const mountPart = moduleRecord.mountPart;
  if (typeof mountPart === "function") {
    return mountPart as MountPartFn;
  }

  const parts = toRecord(moduleRecord.parts);
  if (parts) {
    const candidate = parts[resolvePartDefinitionId(part)]
      ?? parts[part.id]
      ?? (part.component ? parts[part.component] : undefined);
    const resolved = resolvePartCandidate(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return resolvePartCandidate(moduleRecord.default);
}

function resolvePartCandidate(candidate: unknown): MountPartFn | null {
  if (typeof candidate === "function") {
    return candidate as MountPartFn;
  }

  const candidateRecord = toRecord(candidate);
  if (!candidateRecord) {
    return null;
  }

  if (typeof candidateRecord.mount === "function") {
    return candidateRecord.mount as MountPartFn;
  }

  return null;
}

export function resolvePartInstanceId(part: ComposedShellPart): string {
  return part.instanceId ?? part.id;
}

export function resolvePartDefinitionId(part: ComposedShellPart): string {
  return part.definitionId ?? part.id;
}

export function resolvePartArgs(part: ComposedShellPart): Record<string, string> {
  return part.args ? { ...part.args } : {};
}
