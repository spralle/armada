import type { PluginContract, GhostApi, ActivationContext } from "@ghost-shell/contracts/plugin";
import type { HookService, ElementTransitionHook } from "@ghost-shell/contracts/services";
import { HOOK_REGISTRY_SERVICE_ID, ELEMENT_TRANSITION_HOOK_ID } from "@ghost-shell/contracts/services";
import { activateMotion, deactivateMotion } from "./plugin-services-expose.js";
import { createMotionTransitionHook } from "./motion-hook.js";
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

  // Register element transition hook if hook service is available
  if (context.services) {
    const hookService = context.services.getService<HookService>(HOOK_REGISTRY_SERVICE_ID);
    if (hookService) {
      const hook = createMotionTransitionHook();
      const registration = hookService.add<ElementTransitionHook>(ELEMENT_TRANSITION_HOOK_ID, hook);
      context.subscriptions.push(registration);
    }
  }
}

export function deactivate(): void {
  deactivateMotion();
}
