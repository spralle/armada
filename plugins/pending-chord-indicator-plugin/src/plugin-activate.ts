import type { GhostApi, ActivationContext } from "@ghost-shell/contracts";

function activate(_api: GhostApi, _ctx: ActivationContext): void {
  // No activation logic needed — purely a slot widget
}

export { activate };
