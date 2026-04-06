import { composeEnabledPluginContributions } from "@armada/plugin-contracts";
import type { ShellRuntime } from "../app/types.js";
import { escapeHtml } from "../app/utils.js";
import { canReopenClosedTab, getTabCloseability } from "../context-state.js";

export interface ComposedShellPart {
  instanceId: string;
  definitionId: string;
  id: string;
  title: string;
  args: Record<string, string>;
  slot: "main" | "secondary" | "side";
  component?: string;
  pluginId: string;
}

export interface ComposedPartDefinition {
  definitionId: string;
  title: string;
  slot: "main" | "secondary" | "side";
  component?: string;
  pluginId: string;
}

export type PartSlot = ComposedShellPart["slot"];

export function composePartDefinitionsFromRegistrySnapshot(
  snapshot: ReturnType<ShellRuntime["registry"]["getSnapshot"]>,
): ComposedPartDefinition[] {
  const composed = composeEnabledPluginContributions(
    snapshot.plugins.map((plugin) => ({
      id: plugin.id,
      enabled: plugin.enabled,
      contract: plugin.contract,
    })),
  );

  return composed.parts.map((part) => ({
    definitionId: part.id,
    title: part.title,
    slot: part.slot,
    component: part.component,
    pluginId: part.pluginId,
  }));
}

export function getVisiblePartDefinitions(runtime: ShellRuntime): ComposedPartDefinition[] {
  return composePartDefinitionsFromRegistrySnapshot(runtime.registry.getSnapshot());
}

export function getVisibleComposedParts(runtime: ShellRuntime): ComposedShellPart[] {
  const definitionsById = new Map(
    getVisiblePartDefinitions(runtime).map((definition) => [definition.definitionId, definition]),
  );

  const composedParts = runtime.contextState.tabOrder
    .map((tabId) => runtime.contextState.tabs[tabId])
    .filter((tab): tab is NonNullable<typeof tab> => Boolean(tab))
    .map((tab) => {
      const definition = definitionsById.get(tab.definitionId);
      if (!definition) {
        return null;
      }

      return {
        instanceId: tab.id,
        definitionId: definition.definitionId,
        id: tab.id,
        title: tab.label,
        args: tab.args,
        slot: definition.slot,
        component: definition.component,
        pluginId: definition.pluginId,
      } satisfies ComposedShellPart;
    })
    .filter((part) => part !== null);

  return composedParts;
}

export function renderPartCard(
  part: ComposedShellPart,
  runtime: ShellRuntime,
  options: { showPopoutButton: boolean; showRestoreButton?: boolean },
): string {
  const closeability = getTabCloseability(runtime.contextState, part.instanceId);
  const closeabilityAttrs = [
    `data-tab-close-policy="${closeability.policy}"`,
    `data-tab-close-action-availability="${closeability.actionAvailability}"`,
    `data-tab-can-close="${closeability.canClose ? "true" : "false"}"`,
    `data-tab-close-disabled-reason="${closeability.reason ?? "none"}"`,
  ].join(" ");

  const popoutButton = options.showPopoutButton
    ? `<button type="button" data-action="popout" data-tab-id="${part.instanceId}" data-part-id="${part.instanceId}">Pop out</button>`
    : "";
  const restoreButton = options.showRestoreButton
    ? `<button type="button" data-action="restore" data-tab-id="${part.instanceId}" data-part-id="${part.instanceId}">Restore to host</button>`
    : "";

  return `
    <article class="part-root" data-tab-id="${part.instanceId}" data-definition-id="${part.definitionId}" data-part-id="${part.instanceId}" draggable="true" ${closeabilityAttrs}>
      <h2>${escapeHtml(part.title)}</h2>
      <div class="part-actions">
        ${popoutButton}
        ${restoreButton}
      </div>
      ${renderPartBody(part)}
      <div class="dropzone" data-dropzone-for="${part.instanceId}">Drop cross-window payload here</div>
      <p class="runtime-note" data-drop-result-for="${part.instanceId}"></p>
      <p class="runtime-note">Window: ${runtime.windowId}</p>
    </article>
  `;
}

export function updateSelectedStyles(root: HTMLElement, selectedPartId: string | null): void {
  for (const node of root.querySelectorAll<HTMLElement>("article[data-part-id]")) {
    const partId = node.dataset.partId;
    if (partId && partId === selectedPartId) {
      node.classList.add("is-selected");
    } else {
      node.classList.remove("is-selected");
    }
  }
}

export function resolvePartTitle(partId: string, runtime: ShellRuntime): string {
  return getVisibleComposedParts(runtime).find((part) => part.instanceId === partId)?.title ?? partId;
}

export function renderTabStrip(
  slot: PartSlot,
  tabs: ComposedShellPart[],
  activeTabId: string,
  runtime: ShellRuntime,
): string {
  const label = `${slot} panel tabs`;
  const reopenEnabled = !runtime.syncDegraded && canReopenClosedTab(runtime.contextState, slot);
  return `
    <div class="part-tab-strip" role="tablist" aria-label="${escapeHtml(label)}" data-slot-tablist="${slot}">
      ${tabs.map((part) => {
    const isActive = part.instanceId === activeTabId;
    const closeability = getTabCloseability(runtime.contextState, part.instanceId);
    const closeButton = closeability.canClose
      ? `<button
            type="button"
            class="part-tab-close"
            data-action="close-tab"
            data-tab-id="${part.instanceId}"
            aria-label="Close ${escapeHtml(part.title)} tab"
            aria-keyshortcuts="Control+W Meta+W"
            title="Close tab (Ctrl+W)"
          >×</button>`
      : "";
    return `<div class="part-tab-item" data-tab-item="${part.instanceId}" data-tab-can-close="${closeability.canClose ? "true" : "false"}">
        <button
          type="button"
          role="tab"
          class="part-tab${isActive ? " is-active" : ""}"
          id="tab-${part.instanceId}"
          data-action="activate-tab"
          data-slot="${part.slot}"
          data-tab-id="${part.instanceId}"
          data-part-id="${part.instanceId}"
          data-part-definition-id="${part.definitionId}"
          data-part-title="${escapeHtml(part.title)}"
          aria-selected="${isActive ? "true" : "false"}"
          aria-controls="panel-${part.instanceId}"
          tabindex="${isActive ? "0" : "-1"}"
        >${escapeHtml(part.title)}</button>
        ${closeButton}
      </div>`;
  }).join("")}
      <button
        type="button"
        class="part-tab"
        data-action="reopen-closed-tab"
        data-slot="${slot}"
        aria-label="Reopen recently closed tab"
        aria-keyshortcuts="Control+Shift+T Meta+Shift+T"
        title="Reopen closed tab (Ctrl+Shift+T)"
        ${reopenEnabled ? "" : "disabled aria-disabled=\"true\""}
      >↶ Reopen</button>
    </div>
  `;
}

export function isPartActivationNode(target: HTMLElement): target is HTMLButtonElement {
  const action = target.dataset.action;
  return target instanceof HTMLButtonElement && action === "activate-tab";
}

function renderPartBody(part: ComposedShellPart): string {
  const componentLabel = part.component ?? part.definitionId;
  return `<section class="domain-panel" data-domain-panel="runtime-host" data-part-panel-for="${part.instanceId}">
      <section class="domain-panel-host" data-part-content-for="${part.instanceId}"></section>
      <section class="domain-panel-fallback" data-part-fallback-for="${part.instanceId}">
        <h3>${escapeHtml(part.title)}</h3>
        <p class="domain-hint">Component '${escapeHtml(componentLabel)}' is unavailable in this shell runtime.</p>
        <p class="domain-hint">Composition remains extension-driven; this host provides generic fallback rendering only.</p>
      </section>
    </section>`;
}
