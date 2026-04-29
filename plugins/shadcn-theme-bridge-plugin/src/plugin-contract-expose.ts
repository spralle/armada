import type { ActivationContext, GhostApi } from "@ghost-shell/contracts/plugin";
import { createPluginContract } from "@ghost-shell/contracts/plugin";
import pkg from "../package.json" with { type: "json" };
import { injectShadcnBridge, removeShadcnBridge } from "./plugin-services-expose.js";

export const pluginContract = createPluginContract(pkg);

export function activate(_api: GhostApi, context: ActivationContext): void {
  injectShadcnBridge();
  context.subscriptions.push({ dispose: removeShadcnBridge });
}
