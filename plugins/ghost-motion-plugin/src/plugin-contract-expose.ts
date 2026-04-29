import type { ActivationContext, GhostApi } from "@ghost-shell/contracts/plugin";
import { createPluginContract } from "@ghost-shell/contracts/plugin";
import type { ElementTransitionHook, HookService } from "@ghost-shell/contracts/services";
import { ELEMENT_TRANSITION_HOOK_ID, HOOK_REGISTRY_SERVICE_ID } from "@ghost-shell/contracts/services";
import pkg from "../package.json" with { type: "json" };
import { createMotionTransitionHook } from "./motion-hook.js";
import { activateMotion, deactivateMotion } from "./plugin-services-expose.js";

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
