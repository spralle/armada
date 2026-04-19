import type { PluginContract, GhostApi, ActivationContext } from "@ghost/plugin-contracts";
import { injectShadcnBridge, removeShadcnBridge } from "./plugin-services-expose.js";
import pkg from "../package.json" with { type: "json" };

const ghost = pkg.ghost as {
  displayName: string;
  contributes?: Record<string, unknown>;
  dependsOn?: Record<string, unknown>;
  activationEvents?: string[];
};

export const pluginContract: PluginContract = {
  manifest: {
    id: pkg.name,
    name: ghost.displayName,
    version: pkg.version,
  },
  contributes: ghost.contributes as PluginContract["contributes"],
  dependsOn: ghost.dependsOn as PluginContract["dependsOn"],
  activationEvents: ghost.activationEvents as PluginContract["activationEvents"],
};

export function activate(_api: GhostApi, context: ActivationContext): void {
  injectShadcnBridge();
  context.subscriptions.push({ dispose: removeShadcnBridge });
}
