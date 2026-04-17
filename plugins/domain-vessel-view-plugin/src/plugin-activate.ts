import type { GhostApi, ActivationContext } from "@ghost/plugin-contracts";

function activate(api: GhostApi, ctx: ActivationContext): void {
  ctx.subscriptions.push(
    api.actions.registerAction("domain.vessel-view.open", async () => {
      // Stub: will navigate to vessel view
      console.info("[vessel-view] open action invoked");
    }),
  );
  ctx.subscriptions.push(
    api.actions.registerAction("domain.vessel-view.inspect", async () => {
      // Stub: will show vessel details panel
      console.info("[vessel-view] inspect action invoked");
    }),
  );
}

export { activate };
