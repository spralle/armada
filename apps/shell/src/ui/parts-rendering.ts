import { composeEnabledPluginContributions } from "@armada/plugin-contracts";
import type { ShellRuntime } from "../app/types.js";
import { escapeHtml } from "../app/utils.js";
import { canReopenClosedTab, getTabCloseability } from "../context-state.js";

export interface ComposedShellPart {
  id: string;
  partDefinitionId: string;
  title: string;
  slot: "main" | "secondary" | "side";
  component?: string;
  pluginId: string;
}

export type PartSlot = ComposedShellPart["slot"];

export function composePartsFromRegistrySnapshot(
  snapshot: ReturnType<ShellRuntime["registry"]["getSnapshot"]>,
): ComposedShellPart[] {
  const composed = composeEnabledPluginContributions(
    snapshot.plugins.map((plugin) => ({
      id: plugin.id,
      enabled: plugin.enabled,
      contract: plugin.contract,
    })),
  );

  return composed.parts.map((part) => ({
    id: part.id,
    partDefinitionId: part.id,
    title: part.title,
    slot: part.slot,
    component: part.component,
    pluginId: part.pluginId,
  }));
}

export function getVisibleComposedParts(runtime: ShellRuntime): ComposedShellPart[] {
  return composePartsFromRegistrySnapshot(runtime.registry.getSnapshot());
}

export function renderPartCard(
  part: ComposedShellPart,
  runtime: ShellRuntime,
  options: { showPopoutButton: boolean; showRestoreButton?: boolean },
): string {
  const closeability = getTabCloseability(runtime.contextState, part.id);
  const closeabilityAttrs = [
    `data-tab-close-policy="${closeability.policy}"`,
    `data-tab-close-action-availability="${closeability.actionAvailability}"`,
    `data-tab-can-close="${closeability.canClose ? "true" : "false"}"`,
    `data-tab-close-disabled-reason="${closeability.reason ?? "none"}"`,
  ].join(" ");

  const popoutButton = options.showPopoutButton
    ? `<button type="button" data-action="popout" data-part-id="${part.id}">Pop out</button>`
    : "";
  const restoreButton = options.showRestoreButton
    ? `<button type="button" data-action="restore" data-part-id="${part.id}">Restore to host</button>`
    : "";

  return `
    <article class="part-root" data-part-id="${part.id}" draggable="true" ${closeabilityAttrs}>
      <h2>${escapeHtml(part.title)}</h2>
      <div class="part-actions">
        ${popoutButton}
        ${restoreButton}
      </div>
      ${renderPartBody(part)}
      <div class="dropzone" data-dropzone-for="${part.id}">Drop cross-window payload here</div>
      <p class="runtime-note" data-drop-result-for="${part.id}"></p>
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
  return getVisibleComposedParts(runtime).find((part) => part.id === partId)?.title ?? partId;
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
    const isActive = part.id === activeTabId;
    const closeability = getTabCloseability(runtime.contextState, part.id);
    const closeButton = closeability.canClose
      ? `<button
            type="button"
            class="part-tab-close"
            data-action="close-tab"
            data-tab-id="${part.id}"
            aria-label="Close ${escapeHtml(part.title)} tab"
            aria-keyshortcuts="Control+W Meta+W"
            title="Close tab (Ctrl+W)"
          >×</button>`
      : "";
    return `<div class="part-tab-item" data-tab-item="${part.id}" data-tab-can-close="${closeability.canClose ? "true" : "false"}">
        <button
          type="button"
          role="tab"
          class="part-tab${isActive ? " is-active" : ""}"
          id="tab-${part.id}"
          data-action="activate-tab"
          data-slot="${part.slot}"
          data-part-id="${part.id}"
          data-part-title="${escapeHtml(part.title)}"
          aria-selected="${isActive ? "true" : "false"}"
          aria-controls="panel-${part.id}"
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
  const componentLabel = part.component ?? part.id;
  return `<section class="domain-panel" data-domain-panel="runtime-host" data-part-panel-for="${part.id}">
      <section class="domain-panel-host" data-part-content-for="${part.id}"></section>
      <section class="domain-panel-fallback" data-part-fallback-for="${part.id}">
        <h3>${escapeHtml(part.title)}</h3>
        <p class="domain-hint">Component '${escapeHtml(componentLabel)}' is unavailable in this shell runtime.</p>
        <p class="domain-hint">Composition remains extension-driven; this host provides generic fallback rendering only.</p>
      </section>
    </section>`;
}
