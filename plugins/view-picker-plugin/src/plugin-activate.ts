import type { GhostApi, ActivationContext, QuickPickItem } from "@ghost-shell/contracts";

interface ViewPickerItem extends QuickPickItem {
  readonly definitionId: string;
}

function activate(api: GhostApi, ctx: ActivationContext): void {
  ctx.subscriptions.push(
    api.actions.registerAction("shell.view.open", async () => {
      const views = api.views.getViewDefinitions();

      const items: ViewPickerItem[] = views.map((view) => ({
        label: view.title,
        description: view.slot,
        detail: view.pluginId,
        definitionId: view.definitionId,
      }));

      const selected = await api.window.showQuickPick(items, {
        placeholder: "Select a view to open...",
      });

      if (selected) {
        api.views.openView(selected.definitionId);
      }
    }),
  );
}

export { activate };
