import type { ActivationContext, GhostApi } from "@ghost-shell/contracts/plugin";

function activate(_api: GhostApi, _ctx: ActivationContext): void {
  // No activation logic needed — purely a slot widget
}

export { activate };
