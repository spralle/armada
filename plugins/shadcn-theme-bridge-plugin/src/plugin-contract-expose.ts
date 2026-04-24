import { createPluginContract } from "@ghost-shell/contracts/plugin";
import type { GhostApi, ActivationContext } from "@ghost-shell/contracts/plugin";
import { injectShadcnBridge, removeShadcnBridge } from "./plugin-services-expose.js";
import pkg from "../package.json" with { type: "json" };

export const pluginContract = createPluginContract(pkg);

export function activate(_api: GhostApi, context: ActivationContext): void {
  injectShadcnBridge();
  context.subscriptions.push({ dispose: removeShadcnBridge });
}
