import type { PluginContract } from "./types.js";

/**
 * Shape of the `ghost` field embedded in each plugin's package.json.
 * Kept intentionally loose — runtime validation happens in parsePluginContract().
 */
interface PackageJsonGhostField {
  displayName: string;
  contributes?: Record<string, unknown>;
  dependsOn?: Record<string, unknown>;
  activationEvents?: string[];
}

/**
 * Build a {@link PluginContract} from a plugin's package.json.
 *
 * This centralises the cast that every plugin previously duplicated in its
 * `plugin-contract-expose.ts`. No validation is performed here — the shell
 * validates via `parsePluginContract()` at load time.
 */
export function createPluginContract(pkg: { name: string; version: string; ghost: unknown }): PluginContract {
  const { name, version } = pkg;
  const ghost = pkg.ghost as PackageJsonGhostField;

  return {
    manifest: { id: name, name: ghost.displayName, version },
    contributes: ghost.contributes as PluginContract["contributes"],
    dependsOn: ghost.dependsOn as PluginContract["dependsOn"],
    activationEvents: ghost.activationEvents as PluginContract["activationEvents"],
  };
}
