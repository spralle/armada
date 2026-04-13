import type { GhostApi, ActivationContext, QuickPickItem } from "@ghost/plugin-contracts";

interface PaletteItem extends QuickPickItem {
  readonly actionId: string;
}

function activate(api: GhostApi, ctx: ActivationContext): void {
  ctx.subscriptions.push(
    api.actions.registerAction("shell.palette.toggle", async () => {
      const actions = await api.actions.getActions();

      const items: PaletteItem[] = actions.map((action) => ({
        label: action.title,
        description: action.keybinding,
        detail: action.disabledReason,
        enabled: action.enabled,
        actionId: action.id,
      }));

      const selected = await api.window.showQuickPick(items, {
        placeholder: "Type an action...",
      });

      if (selected?.enabled) {
        await api.actions.executeAction(selected.actionId);
      }
    })
  );
}

export { activate };
