/**
 * Part mount resolution utilities — resolves mount functions from remote modules.
 * Extracted from part-module-host for cohesion and file size.
 */

import { resolveModuleMountFn } from "@ghost-shell/contracts";
import type { ComposedShellPart } from "./ui/parts-rendering.js";
import type { ShellRuntime } from "./app/types.js";
import type { MountCleanup } from "./federation-mount-utils.js";

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
  const keys = [
    resolvePartDefinitionId(part),
    part.id,
    ...(part.component ? [part.component] : []),
  ];

  const fn = resolveModuleMountFn(moduleValue, {
    topLevelNames: ["mountPart"],
    collectionName: "parts",
    collectionKeys: keys,
    checkDefault: true,
  });

  return (fn as MountPartFn) ?? null;
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
