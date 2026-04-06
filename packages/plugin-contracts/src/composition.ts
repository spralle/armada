import type {
  PluginContract,
  PluginPartContribution,
  PluginViewContribution,
} from "./types.js";

export interface ComposedPluginViewContribution {
  pluginId: string;
  id: string;
  title: string;
  component: string;
}

export interface ComposedPluginPartContribution {
  pluginId: string;
  id: string;
  title: string;
  slot: "main" | "secondary" | "side";
  component?: string | undefined;
}

export interface ComposedPluginContributions {
  views: ComposedPluginViewContribution[];
  parts: ComposedPluginPartContribution[];
}

export interface PluginContributionSource {
  id: string;
  enabled: boolean;
  contract: PluginContract | null;
}

export function composeEnabledPluginContributions(
  plugins: PluginContributionSource[],
): ComposedPluginContributions {
  const views: ComposedPluginViewContribution[] = [];
  const parts: ComposedPluginPartContribution[] = [];

  for (const plugin of plugins) {
    if (!plugin.enabled || !plugin.contract) {
      continue;
    }

    const contributes = plugin.contract.contributes;
    const pluginViews = contributes?.views ?? [];
    const pluginParts = contributes?.parts ?? [];

    for (const view of pluginViews) {
      views.push(toComposedView(plugin.id, view));
    }

    for (const part of pluginParts) {
      parts.push(toComposedPart(plugin.id, part));
    }
  }

  return {
    views,
    parts,
  };
}

function toComposedView(
  pluginId: string,
  view: PluginViewContribution,
): ComposedPluginViewContribution {
  return {
    pluginId,
    id: view.id,
    title: view.title,
    component: view.component,
  };
}

function toComposedPart(
  pluginId: string,
  part: PluginPartContribution,
): ComposedPluginPartContribution {
  return {
    pluginId,
    id: part.id,
    title: part.title,
    slot: part.slot,
    component: part.component,
  };
}
