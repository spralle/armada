import {
  buildGroupSelectionContextValue,
  buildPrimarySelectionTitle,
  buildSecondarySelectionTitle,
  domainDemoAdapter,
  resolvePrimaryEntity,
  resolveSecondaryEntity,
  toSelectionSyncFields,
} from "../domain-demo-adapter.js";
import {
  createRevision,
  readGroupSelectionContext,
  writeGlobalSelectionLane,
  writeGroupSelectionContext,
} from "../context/runtime-state.js";
import { DRAG_INLINE_PREFIX, DRAG_REF_PREFIX } from "../app/constants.js";
import { safeJson, safeParse, sanitizeForWindowName } from "../app/utils.js";
import type { ShellRuntime } from "../app/types.js";
import type { SelectionSyncEvent } from "../window-bridge.js";
import {
  getVisibleMockParts,
  renderPartCard,
  resolvePartTitle,
  updateSelectedStyles,
} from "./parts-rendering.js";

type PartsControllerDeps = {
  applySelection: (event: SelectionSyncEvent) => void;
  publishWithDegrade: (event: Parameters<ShellRuntime["bridge"]["publish"]>[0]) => void;
  renderContextControls: () => void;
  renderParts: () => void;
  renderSyncStatus: () => void;
  resolveIntentFlow: (intent: {
    type: string;
    facts: Record<string, unknown>;
  }) => void;
};

export function renderParts(root: HTMLElement, runtime: ShellRuntime, deps: PartsControllerDeps): void {
  const visibleParts = getVisibleMockParts(runtime);

  if (runtime.isPopout) {
    const slot = root.querySelector<HTMLElement>("#popout-slot");
    if (!slot) {
      return;
    }

    const part = runtime.partId ? visibleParts.find((item) => item.id === runtime.partId) : null;
    if (!part) {
      slot.innerHTML = `<article class="part-root"><h2>Popout unavailable</h2><p>Unable to resolve requested part.</p></article>`;
      return;
    }

    slot.innerHTML = renderPartCard(part, runtime, { showPopoutButton: false, showRestoreButton: true });
    wirePartActions(root, runtime, deps);
    wireDragDrop(root, runtime);
    updateSelectedStyles(root, runtime.selectedPartId);
    return;
  }

  const partsBySlot = {
    master: root.querySelector<HTMLElement>("#slot-master-parts"),
    secondary: root.querySelector<HTMLElement>("#slot-secondary-parts"),
    side: root.querySelector<HTMLElement>("#slot-side-parts"),
  };

  for (const slotNode of Object.values(partsBySlot)) {
    if (slotNode) {
      slotNode.innerHTML = "";
    }
  }

  for (const part of visibleParts) {
    if (runtime.poppedOutPartIds.has(part.id)) {
      continue;
    }

    const slotNode = partsBySlot[part.slot];
    if (!slotNode) {
      continue;
    }

    slotNode.insertAdjacentHTML("beforeend", renderPartCard(part, runtime, { showPopoutButton: true }));
  }

  wirePartActions(root, runtime, deps);
  wireDragDrop(root, runtime);
  updateSelectedStyles(root, runtime.selectedPartId);
}

export function startPopoutWatchdog(root: HTMLElement, runtime: ShellRuntime, deps: Pick<PartsControllerDeps, "renderParts" | "renderSyncStatus">): void {
  window.setInterval(() => {
    for (const [partId, handle] of runtime.popoutHandles.entries()) {
      if (handle.closed) {
        runtime.popoutHandles.delete(partId);
        if (runtime.poppedOutPartIds.has(partId)) {
          runtime.poppedOutPartIds.delete(partId);
          runtime.notice = `Part '${partId}' restored (popout closed).`;
          deps.renderParts();
          deps.renderSyncStatus();
        }
      }
    }
  }, 1_000);
}

function wirePartActions(root: HTMLElement, runtime: ShellRuntime, deps: PartsControllerDeps): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='select']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }

      const partId = button.dataset.partId;
      const partTitle = button.dataset.partTitle;
      if (!partId || !partTitle) {
        return;
      }

      const selectionRevision = createRevision(runtime.windowId);
      const selection = toSelectionSyncFields({
        primaryEntityId: runtime.selectedPrimaryEntityId,
        secondaryEntityId: runtime.selectedSecondaryEntityId,
      });

      deps.applySelection({
        selectedPartId: partId,
        selectedPartTitle: partTitle,
        ...selection,
        revision: selectionRevision,
        sourceWindowId: runtime.windowId,
        type: "selection",
      });

      deps.publishWithDegrade({
        type: "selection",
        selectedPartId: partId,
        selectedPartTitle: partTitle,
        ...selection,
        revision: selectionRevision,
        sourceWindowId: runtime.windowId,
      });

      writeGlobalSelectionLane(runtime, {
        selectedPartId: partId,
        selectedPartTitle: partTitle,
        revision: selectionRevision,
      });
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>(`button[data-action='${domainDemoAdapter.actionNames.selectPrimary}']`)) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }

      const primaryEntityId = button.dataset[domainDemoAdapter.dataAttributes.primaryEntityId];
      if (!primaryEntityId) {
        return;
      }

      const primaryEntity = resolvePrimaryEntity(primaryEntityId);
      if (!primaryEntity) {
        return;
      }

      runtime.selectedPrimaryEntityId = primaryEntity.id;
      runtime.selectedSecondaryEntityId = primaryEntity.vesselId;

      const selectionRevision = createRevision(runtime.windowId);

      deps.applySelection({
        type: "selection",
        selectedPartId: domainDemoAdapter.partIds.primary,
        selectedPartTitle: buildPrimarySelectionTitle(primaryEntity),
        ...toSelectionSyncFields({
          primaryEntityId: primaryEntity.id,
          secondaryEntityId: primaryEntity.vesselId,
        }),
        revision: selectionRevision,
        sourceWindowId: runtime.windowId,
      });

      writeGroupSelectionContext(runtime, buildGroupSelectionContextValue({
        primaryEntityId: primaryEntity.id,
        secondaryEntityId: primaryEntity.vesselId,
      }));
      deps.resolveIntentFlow({
        type: domainDemoAdapter.intentTypes.primarySelected,
        facts: {
          sourceType: domainDemoAdapter.entityTypes.primary,
          targetType: domainDemoAdapter.entityTypes.secondary,
          source: {
            orderId: primaryEntity.id,
          },
          target: {
            vesselId: primaryEntity.vesselId,
            vesselClass: resolveSecondaryEntity(primaryEntity.vesselId)?.vesselClass ?? null,
          },
        },
      });
      deps.renderParts();
      deps.renderContextControls();
      deps.renderSyncStatus();

      deps.publishWithDegrade({
        type: "selection",
        selectedPartId: domainDemoAdapter.partIds.primary,
        selectedPartTitle: buildPrimarySelectionTitle(primaryEntity),
        ...toSelectionSyncFields({
          primaryEntityId: primaryEntity.id,
          secondaryEntityId: primaryEntity.vesselId,
        }),
        revision: selectionRevision,
        sourceWindowId: runtime.windowId,
      });
      deps.publishWithDegrade({
        type: "context",
        scope: "group",
        tabId: runtime.selectedPartId ?? undefined,
        contextKey: domainDemoAdapter.laneKeys.groupSelection,
        contextValue: readGroupSelectionContext(runtime),
        revision: createRevision(runtime.windowId),
        sourceWindowId: runtime.windowId,
      });

      writeGlobalSelectionLane(runtime, {
        selectedPartId: domainDemoAdapter.partIds.primary,
        selectedPartTitle: buildPrimarySelectionTitle(primaryEntity),
        revision: selectionRevision,
      });
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>(`button[data-action='${domainDemoAdapter.actionNames.selectSecondary}']`)) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }

      const secondaryEntityId = button.dataset[domainDemoAdapter.dataAttributes.secondaryEntityId];
      if (!secondaryEntityId) {
        return;
      }

      const secondaryEntity = resolveSecondaryEntity(secondaryEntityId);
      if (!secondaryEntity) {
        return;
      }

      runtime.selectedSecondaryEntityId = secondaryEntity.id;
      const selectedPrimaryEntity = runtime.selectedPrimaryEntityId
        ? resolvePrimaryEntity(runtime.selectedPrimaryEntityId)
        : null;
      if (!selectedPrimaryEntity || selectedPrimaryEntity.vesselId !== secondaryEntity.id) {
        runtime.selectedPrimaryEntityId = null;
      }

      const selectionRevision = createRevision(runtime.windowId);

      deps.applySelection({
        type: "selection",
        selectedPartId: domainDemoAdapter.partIds.secondary,
        selectedPartTitle: buildSecondarySelectionTitle(secondaryEntity),
        ...toSelectionSyncFields({
          primaryEntityId: runtime.selectedPrimaryEntityId,
          secondaryEntityId: secondaryEntity.id,
        }),
        revision: selectionRevision,
        sourceWindowId: runtime.windowId,
      });

      writeGroupSelectionContext(runtime, buildGroupSelectionContextValue({
        primaryEntityId: null,
        secondaryEntityId: secondaryEntity.id,
      }));
      deps.resolveIntentFlow({
        type: domainDemoAdapter.intentTypes.secondarySelected,
        facts: {
          sourceType: domainDemoAdapter.entityTypes.secondary,
          targetType: domainDemoAdapter.entityTypes.primary,
          source: {
            vesselId: secondaryEntity.id,
            vesselClass: secondaryEntity.vesselClass,
          },
        },
      });
      deps.renderParts();
      deps.renderContextControls();
      deps.renderSyncStatus();

      deps.publishWithDegrade({
        type: "selection",
        selectedPartId: domainDemoAdapter.partIds.secondary,
        selectedPartTitle: buildSecondarySelectionTitle(secondaryEntity),
        ...toSelectionSyncFields({
          primaryEntityId: runtime.selectedPrimaryEntityId,
          secondaryEntityId: secondaryEntity.id,
        }),
        revision: selectionRevision,
        sourceWindowId: runtime.windowId,
      });
      deps.publishWithDegrade({
        type: "context",
        scope: "group",
        tabId: runtime.selectedPartId ?? undefined,
        contextKey: domainDemoAdapter.laneKeys.groupSelection,
        contextValue: readGroupSelectionContext(runtime),
        revision: createRevision(runtime.windowId),
        sourceWindowId: runtime.windowId,
      });

      writeGlobalSelectionLane(runtime, {
        selectedPartId: domainDemoAdapter.partIds.secondary,
        selectedPartTitle: buildSecondarySelectionTitle(secondaryEntity),
        revision: selectionRevision,
      });
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='popout']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }

      const partId = button.dataset.partId;
      if (!partId) {
        return;
      }

      openPopout(partId, runtime, deps);
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='restore']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }

      const partId = button.dataset.partId;
      if (!partId) {
        return;
      }

      if (runtime.hostWindowId) {
        deps.publishWithDegrade({
          type: "popout-restore-request",
          partId,
          hostWindowId: runtime.hostWindowId,
          sourceWindowId: runtime.windowId,
        });
      }

      window.close();
    });
  }
}

function wireDragDrop(root: HTMLElement, runtime: ShellRuntime): void {
  for (const partNode of root.querySelectorAll<HTMLElement>("article[data-part-id]")) {
    partNode.addEventListener("dragstart", (event) => {
      const dataTransfer = event.dataTransfer;
      const partId = partNode.dataset.partId;
      if (!dataTransfer || !partId) {
        return;
      }

      const payload = {
        partId,
        partTitle: resolvePartTitle(partId),
        sourceWindowId: runtime.windowId,
        createdAt: new Date().toISOString(),
      };

      if (runtime.dragSessionBroker.available) {
        const ref = runtime.dragSessionBroker.create(payload);
        dataTransfer.setData("text/plain", `${DRAG_REF_PREFIX}${ref.id}`);
      } else {
        dataTransfer.setData("text/plain", `${DRAG_INLINE_PREFIX}${JSON.stringify(payload)}`);
      }

      dataTransfer.effectAllowed = "copyMove";
    });

    partNode.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    });

    partNode.addEventListener("drop", (event) => {
      event.preventDefault();
      const dataTransfer = event.dataTransfer;
      const targetPartId = partNode.dataset.partId;
      if (!dataTransfer || !targetPartId) {
        return;
      }

      const raw = dataTransfer.getData("text/plain");
      const resultNode = root.querySelector<HTMLElement>(`[data-drop-result-for='${targetPartId}']`);
      if (!resultNode) {
        return;
      }

      if (raw.startsWith(DRAG_REF_PREFIX)) {
        const id = raw.slice(DRAG_REF_PREFIX.length);
        const payload = runtime.dragSessionBroker.consume({ id });
        if (!payload) {
          resultNode.textContent = "Drop failed: session missing/expired (bridge unavailable or stale ref).";
          return;
        }

        resultNode.textContent = `Dropped via session ref: ${safeJson(payload)}`;
        return;
      }

      if (raw.startsWith(DRAG_INLINE_PREFIX)) {
        const payload = safeParse(raw.slice(DRAG_INLINE_PREFIX.length));
        resultNode.textContent = payload
          ? `Dropped via inline fallback: ${safeJson(payload)}`
          : "Drop failed: invalid inline payload.";
        return;
      }

      resultNode.textContent = "Drop ignored: unsupported payload format.";
    });
  }
}

function openPopout(partId: string, runtime: ShellRuntime, deps: Pick<PartsControllerDeps, "renderParts" | "renderSyncStatus">): void {
  if (runtime.isPopout) {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("popout", "1");
  url.searchParams.set("partId", partId);
  url.searchParams.set("hostWindowId", runtime.windowId);

  const popout = window.open(url.toString(), `armada-popout-${sanitizeForWindowName(partId)}`);
  if (!popout) {
    runtime.notice = `Popup blocked. Could not pop out '${partId}'.`;
    deps.renderSyncStatus();
    return;
  }

  runtime.popoutHandles.set(partId, popout);
  runtime.poppedOutPartIds.add(partId);
  runtime.notice = `Part '${partId}' opened in a new window.`;
  deps.renderParts();
  deps.renderSyncStatus();
}

export function restorePart(partId: string, runtime: ShellRuntime, deps: Pick<PartsControllerDeps, "renderParts" | "renderSyncStatus">): void {
  runtime.poppedOutPartIds.delete(partId);

  const handle = runtime.popoutHandles.get(partId);
  if (handle && !handle.closed) {
    handle.close();
  }

  runtime.popoutHandles.delete(partId);
  runtime.notice = `Part '${partId}' restored to host window.`;
  deps.renderParts();
  deps.renderSyncStatus();
}
