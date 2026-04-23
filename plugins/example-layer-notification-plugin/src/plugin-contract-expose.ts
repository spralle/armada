import type { PluginContract } from "@ghost-shell/contracts";
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
