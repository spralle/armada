import { createPluginContract } from "@ghost-shell/contracts/plugin";
import type { GhostApi, ActivationContext } from "@ghost-shell/contracts/plugin";
import type { HookService, ElementTransitionHook } from "@ghost-shell/contracts/services";
import { HOOK_REGISTRY_SERVICE_ID, ELEMENT_TRANSITION_HOOK_ID } from "@ghost-shell/contracts/services";
import { activateMotion, deactivateMotion } from "./plugin-services-expose.js";
import { createMotionTransitionHook } from "./motion-hook.js";
import pkg from "../package.json" with { type: "json" };

export const pluginContract = createPluginContract(pkg);

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
