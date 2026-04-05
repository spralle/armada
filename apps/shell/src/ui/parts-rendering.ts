import { composeEnabledPluginContributions } from "@armada/plugin-contracts";
import { domainDemoAdapter } from "../domain-demo-adapter.js";
import type { ShellRuntime } from "../app/types.js";
import { escapeHtml } from "../app/utils.js";
import {
  demoUnplannedOrders,
  demoVessels,
  getOrdersForVessel,
} from "../domain-demo-data.js";

export interface ComposedShellPart {
  id: string;
  title: string;
  slot: "main" | "secondary" | "side";
  component: string;
  pluginId: string;
}

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
  const popoutButton = options.showPopoutButton
    ? `<button type="button" data-action="popout" data-part-id="${part.id}">Pop out</button>`
    : "";
  const restoreButton = options.showRestoreButton
    ? `<button type="button" data-action="restore" data-part-id="${part.id}">Restore to host</button>`
    : "";

  return `
    <article class="part-root" data-part-id="${part.id}" draggable="true">
      <h2>${part.title}</h2>
      <div class="part-actions">
        <button type="button" data-action="select" data-part-id="${part.id}" data-part-title="${part.title}">Select</button>
        ${popoutButton}
        ${restoreButton}
      </div>
      ${renderPartBody(part, runtime)}
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

export function isSelectionActionNode(target: HTMLElement): target is HTMLButtonElement {
  const action = target.dataset.action;
  return target instanceof HTMLButtonElement && (
    action === domainDemoAdapter.actionNames.selectPrimary ||
    action === domainDemoAdapter.actionNames.selectSecondary
  );
}

function renderPartBody(part: ComposedShellPart, runtime: ShellRuntime): string {
  if (part.component === "UnplannedOrdersPart") {
    const rows = demoUnplannedOrders
      .map((order) => {
        const selectedClass =
          runtime.selectedPrimaryEntityId === order.id ? "domain-row is-selected" : "domain-row";
        return `<button type="button" class="${selectedClass}" data-action="select-order" data-order-id="${escapeHtml(order.id)}" data-vessel-id="${escapeHtml(order.vesselId)}">
            <strong>${escapeHtml(order.reference)}</strong>
            <span>${escapeHtml(order.cargoType.toUpperCase())} · ${escapeHtml(order.destination)}</span>
          </button>`;
      })
      .join("");

    return `<section class="domain-panel" data-domain-panel="orders">
        <h3>Unplanned orders</h3>
        <p class="domain-hint">Select an order to focus the related vessel.</p>
        <div class="domain-list">${rows}</div>
      </section>`;
  }

  if (part.component === "VesselViewPart") {
    const rows = demoVessels
      .map((vessel) => {
        const orderCount = getOrdersForVessel(vessel.id).length;
        const selectedClass =
          runtime.selectedSecondaryEntityId === vessel.id ? "domain-row is-selected" : "domain-row";
        return `<button type="button" class="${selectedClass}" data-action="select-vessel" data-vessel-id="${escapeHtml(vessel.id)}">
            <strong>${escapeHtml(vessel.name)}</strong>
            <span>${escapeHtml(vessel.vesselClass)} · ${escapeHtml(vessel.route)} · ${orderCount} unplanned</span>
          </button>`;
      })
      .join("");

    return `<section class="domain-panel" data-domain-panel="vessels">
        <h3>Vessel view</h3>
        <p class="domain-hint">Select a vessel to focus matching unplanned orders.</p>
        <div class="domain-list">${rows}</div>
      </section>`;
  }

  return `<section class="domain-panel" data-domain-panel="unavailable">
      <h3>${escapeHtml(part.title)}</h3>
      <p class="domain-hint">Component '${escapeHtml(part.component)}' is unavailable in this shell runtime.</p>
    </section>`;
}
