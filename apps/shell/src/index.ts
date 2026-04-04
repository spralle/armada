import type { PluginContract } from "@armada/plugin-contracts";

export interface ShellBootstrapState {
  mode: "inner-loop" | "integration";
  loadedPlugins: PluginContract[];
}

export const shellBootstrapState: ShellBootstrapState = {
  mode: "inner-loop",
  loadedPlugins: [],
};

console.log("[shell] POC shell stub ready", shellBootstrapState.mode);
