import type { PluginContract, GhostApi, ActivationContext } from "@ghost/plugin-contracts";
import { activateMotion, deactivateMotion } from "./plugin-services-expose.js";
import pkg from "../package.json" with { type: "json" };

const ghost = pkg.ghost as {
  displayName: string;
  contributes?: Record<string, unknown>;
  dependsOn?: Record<string, unknown>;
  activationEvents?: string[];
};

export const pluginContract: PluginContract = {
  manifest: { id: pkg.name, name: ghost.displayName, version: pkg.version },
  // Pattern: package.json ghost field cast — matches shadcn-theme-bridge-plugin.
  // Safe because the shell validates the contract via parsePluginContract() on load.
  contributes: ghost.contributes as PluginContract["contributes"],
  dependsOn: ghost.dependsOn as PluginContract["dependsOn"],
  activationEvents: ghost.activationEvents as PluginContract["activationEvents"],
};

export function activate(_api: GhostApi, context: ActivationContext): void {
  activateMotion();
  context.subscriptions.push({ dispose: deactivateMotion });
}

export function deactivate(): void {
  deactivateMotion();
}
