import type { ViewService, ViewDescriptor, OpenViewOptions } from "@ghost/plugin-contracts";

export interface ViewServiceDeps {
  getPartDefinitions(): { definitionId: string; title: string; slot: string; pluginId: string }[];
  openPartInstance(input: { definitionId: string; args?: Record<string, string>; tabLabel?: string }): string;
}

export function createViewService(deps: ViewServiceDeps): ViewService {
  return {
    getViewDefinitions(): ViewDescriptor[] {
      return deps.getPartDefinitions().map((def) => ({
        definitionId: def.definitionId,
        title: def.title,
        slot: def.slot as "main" | "secondary" | "side",
        pluginId: def.pluginId,
      }));
    },
    openView(definitionId: string, options?: OpenViewOptions): string {
      return deps.openPartInstance({
        definitionId,
        args: options?.args,
        tabLabel: options?.label,
      });
    },
  };
}
