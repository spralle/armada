import { domainDemoAdapter } from "../domain-demo-adapter.js";
import { localMockParts, type LocalMockPart } from "../mock-parts.js";
import type { ShellRuntime } from "../app/types.js";

export function getVisibleMockParts(runtime: ShellRuntime): LocalMockPart[] {
  const enabledPluginIds = new Set(
    runtime.registry
      .getSnapshot()
      .plugins.filter((plugin) => plugin.enabled)
      .map((plugin) => plugin.id),
  );

  return localMockParts.filter((part) => {
    if (part.alwaysVisible) {
      return true;
    }

    if (!part.ownerPluginId) {
      return true;
    }

    return enabledPluginIds.has(part.ownerPluginId);
  });
}

export function renderPartCard(
  part: LocalMockPart,
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
      ${part.render({
    selectedPrimaryEntityId: runtime.selectedPrimaryEntityId,
    selectedSecondaryEntityId: runtime.selectedSecondaryEntityId,
  })}
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

export function resolvePartTitle(partId: string): string {
  return localMockParts.find((part) => part.id === partId)?.title ?? partId;
}

export function isSelectionActionNode(target: HTMLElement): target is HTMLButtonElement {
  const action = target.dataset.action;
  return target instanceof HTMLButtonElement && (
    action === domainDemoAdapter.actionNames.selectPrimary ||
    action === domainDemoAdapter.actionNames.selectSecondary
  );
}
