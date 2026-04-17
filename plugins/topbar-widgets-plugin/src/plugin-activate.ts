import type { GhostApi, ActivationContext } from "@ghost/plugin-contracts";

// The toggle action is handled shell-side (needs runtime.layout access).
// This plugin only contributes slot mounts — no activation logic needed.
function activate(_api: GhostApi, _ctx: ActivationContext): void {
  // no-op
}

export { activate };
