import type { GhostApi, ActivationContext } from "@ghost-shell/contracts/plugin";

function activate(api: GhostApi, ctx: ActivationContext): void {
  ctx.subscriptions.push(
    api.actions.registerAction("domain.unplanned-orders.open", async () => {
      // Stub: will navigate to unplanned orders view
      console.info("[unplanned-orders] open action invoked");
    }),
  );
  ctx.subscriptions.push(
    api.actions.registerAction(
      "domain.unplanned-orders.inspect",
      async () => {
        // Stub: will show order details panel
        console.info("[unplanned-orders] inspect action invoked");
      },
    ),
  );
}

export { activate };
