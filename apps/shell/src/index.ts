import {
  getTabGroupId,
  registerTab,
  setActiveTab,
  writeGlobalLane,
  writeGroupLaneByGroup,
  writeGroupLaneByTab,
} from "./context-state.js";
import {
  CORE_GROUP_CONTEXT_KEY,
  createRevision,
  ensureTabsRegistered,
  readGroupSelectionContext,
  updateContextState,
  writeGlobalSelectionLane,
  writeGroupSelectionContext,
} from "./context/runtime-state.js";
import {
  createActionCatalogFromRegistrySnapshot,
  resolveIntentWithTrace,
  type IntentActionMatch,
  type ShellIntent,
} from "./intent-runtime.js";
import {
  formatDegradedModeAnnouncement,
  formatSelectionAnnouncement,
  resolveChooserFocusRestoration,
  resolveChooserKeyboardAction,
  resolveDegradedKeyboardInteraction,
} from "./keyboard-a11y.js";
import { applyPaneResize, type ShellLayoutState } from "./layout.js";
import { DEFAULT_GROUP_COLOR, DEFAULT_GROUP_ID } from "./app/constants.js";
import { shellBootstrapState } from "./app/bootstrap.js";
import { bootstrapShellWithTenantManifest } from "./app/bootstrap.js";
import { createShellRuntime } from "./app/runtime.js";
import type { ShellRuntime } from "./app/types.js";
import { type PluginActivationTriggerType } from "./plugin-registry.js";
import {
  createWindowId,
  escapeHtml,
} from "./app/utils.js";
import {
  type ContextSyncEvent,
  type SelectionSyncEvent,
} from "./window-bridge.js";
import {
  handleSyncAck as handleSyncAckState,
  handleSyncProbe as handleSyncProbeState,
  publishWithDegrade as publishWithDegradeState,
  requestSyncProbe as requestSyncProbeState,
} from "./sync/bridge-degraded.js";
import { applySelectionPropagation } from "./domain/selection-graph.js";
import {
  getVisibleComposedParts,
  isSelectionActionNode,
  updateSelectedStyles,
} from "./ui/parts-rendering.js";
import {
  renderParts as renderPartsView,
  restorePart,
  startPopoutWatchdog,
} from "./ui/parts-controller.js";
import {
  mountMainWindow,
  mountPopout,
} from "./ui/shell-mount.js";
import {
  updateWindowReadOnlyState,
} from "./ui/context-controls.js";
import { createReactPanelsHost } from "./ui/react/panels-host.js";

const panelsByRuntime = new WeakMap<ShellRuntime, ReturnType<typeof createReactPanelsHost>>();

export function startShell(root: HTMLElement): ShellRuntime {
  const shellRuntime = createShellRuntime();
  mountShell(root, shellRuntime);
  initializeReactPanels(root, shellRuntime);

  if (!shellRuntime.isPopout) {
    void hydratePluginRegistry(root, shellRuntime);
  }

  console.log("[shell] POC shell stub ready", shellBootstrapState.mode);

  return shellRuntime;
}

function mountShell(root: HTMLElement, runtime: ShellRuntime): void {
  if (runtime.isPopout) {
    mountPopout(root, runtime, {
      renderParts: () => renderParts(root, runtime),
      updateWindowReadOnlyState: () => updateWindowReadOnlyState(root, runtime),
      setupResize: () => setupResize(root, runtime),
      publishRestoreRequestOnUnload: () => {
        publishWithDegrade(root, runtime, {
          type: "popout-restore-request",
          hostWindowId: runtime.hostWindowId!,
          partId: runtime.partId!,
          sourceWindowId: runtime.windowId,
        });
      },
    });
  } else {
    mountMainWindow(root, {
      renderParts: () => renderParts(root, runtime),
      updateWindowReadOnlyState: () => updateWindowReadOnlyState(root, runtime),
      setupResize: () => setupResize(root, runtime),
      publishRestoreRequestOnUnload: () => {},
    });
    applyLayout(root, runtime.layout);
    startPopoutWatchdog(root, runtime, {
      renderParts: () => renderParts(root, runtime),
      renderSyncStatus: () => renderSyncStatus(root, runtime),
    });
  }

  bindBridgeSync(root, runtime);
  bindKeyboardShortcuts(root, runtime);
}

function initializeReactPanels(root: HTMLElement, runtime: ShellRuntime): void {
  const host = createReactPanelsHost(root, runtime, {
    onApplyContextValue: (value) => {
      if (runtime.syncDegraded) {
        return;
      }

      writeGroupSelectionContext(runtime, value);
      publishWithDegrade(root, runtime, {
        type: "context",
        scope: "group",
        tabId: runtime.selectedPartId ?? undefined,
        contextKey: CORE_GROUP_CONTEXT_KEY,
        contextValue: value,
        revision: createRevision(runtime.windowId),
        sourceWindowId: runtime.windowId,
      });
      renderSyncStatus(root, runtime);
    },
    onTogglePlugin: async (pluginId, enabled) => {
      try {
        runtime.pluginNotice = "";
        await runtime.registry.setEnabled(pluginId, enabled);
        refreshCommandContributions(runtime);
      } catch (error) {
        runtime.pluginNotice = `Unable to toggle plugin '${pluginId}'. See console diagnostics.`;
        console.error("[shell] failed to toggle plugin", pluginId, error);
      }

      renderPanels(root, runtime);
      renderParts(root, runtime);
      renderCommandSurface(root, runtime);
    },
    onChooseIntentAction: (index) => {
      runtime.chooserFocusIndex = index;
      const selectedMatch = runtime.pendingIntentMatches[index];
      if (!selectedMatch) {
        return;
      }
      executeResolvedAction(root, runtime, selectedMatch, runtime.pendingIntent);
    },
    onDismissChooser: () => {
      dismissIntentChooser(root, runtime);
    },
    onPendingFocusApplied: () => {
      runtime.pendingFocusSelector = null;
    },
  });

  panelsByRuntime.set(runtime, host);
  refreshCommandContributions(runtime);
  renderPanels(root, runtime);
  renderCommandSurface(root, runtime);
}

async function hydratePluginRegistry(root: HTMLElement, runtime: ShellRuntime): Promise<void> {
  try {
    const state = await bootstrapShellWithTenantManifest({
      tenantId: "demo",
    });
    runtime.registry = state.registry;
    refreshCommandContributions(runtime);
    renderPanels(root, runtime);
    renderParts(root, runtime);
    renderCommandSurface(root, runtime);
  } catch (error) {
    console.warn("[shell] plugin registry hydration skipped", error);
  }
}

function refreshCommandContributions(runtime: ShellRuntime): void {
  const contracts = runtime.registry
    .getSnapshot()
    .plugins
    .filter((plugin) => plugin.enabled && plugin.contract !== null)
    .map((plugin) => plugin.contract)
    .filter((plugin): plugin is NonNullable<typeof plugin> => plugin !== null);

  runtime.commandSurface.registerContracts(contracts);
}

function renderPanels(root: HTMLElement, runtime: ShellRuntime): void {
  const host = panelsByRuntime.get(runtime);
  if (!host) {
    return;
  }

  host.render();
  updateWindowReadOnlyState(root, runtime);
}

function renderParts(root: HTMLElement, runtime: ShellRuntime): void {
  void primeEnabledPluginActivations(root, runtime);
  const visibleParts = getVisibleComposedParts(runtime);
  updateContextState(runtime, ensureTabsRegistered(runtime.contextState, visibleParts));
  renderPartsView(root, runtime, {
    applySelection: (event) => applySelection(root, runtime, event),
    publishWithDegrade: (event) => {
      publishWithDegrade(root, runtime, event);
    },
    renderContextControls: () => renderContextControlsPanel(root, runtime),
    renderParts: () => renderParts(root, runtime),
    renderSyncStatus: () => renderSyncStatus(root, runtime),
  });
  updateWindowReadOnlyState(root, runtime);
}

function bindBridgeSync(root: HTMLElement, runtime: ShellRuntime): void {
  runtime.bridge.subscribeHealth((health) => {
    if (health.degraded) {
      runtime.syncDegraded = true;
      runtime.syncDegradedReason = health.reason;
      runtime.pendingProbeId = null;
      announce(root, runtime, formatDegradedModeAnnouncement(true, runtime.syncDegradedReason));
      updateWindowReadOnlyState(root, runtime);
      renderSyncStatus(root, runtime);
      renderContextControlsPanel(root, runtime);
      return;
    }

    if (runtime.syncDegraded) {
      requestSyncProbe(root, runtime);
      renderSyncStatus(root, runtime);
      renderContextControlsPanel(root, runtime);
      updateWindowReadOnlyState(root, runtime);
      return;
    }

    runtime.syncDegradedReason = null;
    announce(root, runtime, formatDegradedModeAnnouncement(false, null));
    updateWindowReadOnlyState(root, runtime);
  });

  runtime.bridge.subscribe((event) => {
    if (event.sourceWindowId === runtime.windowId) {
      return;
    }

    if (event.type === "sync-probe") {
      handleSyncProbe(runtime, event);
      return;
    }

    if (event.type === "sync-ack") {
      if (handleSyncAck(root, runtime, event)) {
        return;
      }
    }

    if (runtime.syncDegraded) {
      return;
    }

    if (event.type === "selection") {
      applySelection(root, runtime, event);
      return;
    }

    if (event.type === "context") {
      applyContext(root, runtime, event);
      return;
    }

    if (event.type === "popout-restore-request" && !runtime.isPopout) {
      if (event.hostWindowId !== runtime.windowId) {
        return;
      }

      restorePart(event.partId, runtime, {
        renderParts: () => renderParts(root, runtime),
        renderSyncStatus: () => renderSyncStatus(root, runtime),
      });
    }
  });
}

function bindKeyboardShortcuts(root: HTMLElement, runtime: ShellRuntime): void {
  root.addEventListener("keydown", async (event) => {
    if (handleChooserKeyboardEvent(root, runtime, event)) {
      return;
    }

    if (runtime.syncDegraded) {
      const degradedInteraction = resolveDegradedKeyboardInteraction(event.key, runtime.pendingIntentMatches.length > 0);
      if (degradedInteraction === "dismiss-chooser") {
        event.preventDefault();
        dismissIntentChooser(root, runtime);
        return;
      }

      if (degradedInteraction === "block") {
        event.preventDefault();
      }
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const normalizedKey = normalizeKeyEvent(event);
    if (normalizedKey) {
      const keyResult = runtime.commandSurface.dispatchKeybinding(normalizedKey, toCommandContext(runtime));
      if (keyResult?.executed) {
        event.preventDefault();
        const pluginId = resolvePluginIdForCommand(runtime, keyResult.commandId);
        if (pluginId) {
          await activatePluginForBoundary(root, runtime, {
            pluginId,
            triggerType: "command",
            triggerId: keyResult.commandId,
          });
        }
        runtime.commandNotice = `Keybinding (${normalizedKey}): ${keyResult.message}`;
        renderCommandSurface(root, runtime);
        return;
      }
    }

    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && isSelectionActionNode(target)) {
      const selector = `[data-action='${target.dataset.action ?? ""}']`;
      const nodes = [...root.querySelectorAll<HTMLElement>(selector)];
      const index = nodes.indexOf(target);
      if (index < 0 || nodes.length <= 1) {
        return;
      }

      const nextIndex = event.key === "ArrowDown"
        ? (index + 1) % nodes.length
        : (index - 1 + nodes.length) % nodes.length;
      nodes[nextIndex]?.focus();
      event.preventDefault();
      return;
    }

    if (event.key === "Enter" && target.id === "context-value-input") {
      const apply = root.querySelector<HTMLButtonElement>("#context-apply");
      apply?.click();
      event.preventDefault();
    }
  });
}

function handleChooserKeyboardEvent(root: HTMLElement, runtime: ShellRuntime, event: KeyboardEvent): boolean {
  if (!runtime.pendingIntentMatches.length) {
    return false;
  }

  const result = resolveChooserKeyboardAction(
    event.key,
    runtime.chooserFocusIndex,
    runtime.pendingIntentMatches.length,
  );

  if (result.kind === "none") {
    return false;
  }

  event.preventDefault();
  if (result.kind === "focus") {
    runtime.chooserFocusIndex = result.index;
    runtime.pendingFocusSelector = `button[data-action='choose-intent-action'][data-intent-index='${result.index}']`;
    renderSyncStatus(root, runtime);
    return true;
  }

  if (result.kind === "execute") {
    runtime.chooserFocusIndex = result.index;
    const selected = runtime.pendingIntentMatches[result.index];
    if (selected) {
      executeResolvedAction(root, runtime, selected, runtime.pendingIntent);
    }
    return true;
  }

  dismissIntentChooser(root, runtime);
  return true;
}

function dismissIntentChooser(root: HTMLElement, runtime: ShellRuntime): void {
  runtime.pendingIntentMatches = [];
  runtime.pendingIntent = null;
  runtime.chooserFocusIndex = 0;
  runtime.intentNotice = "Action chooser dismissed.";
  const restoreSelector = resolveChooserFocusRestoration("dismiss", runtime.chooserReturnFocusSelector);
  runtime.chooserReturnFocusSelector = null;
  runtime.pendingFocusSelector = restoreSelector;
  announce(root, runtime, runtime.intentNotice);
  renderSyncStatus(root, runtime);
}

function applySelection(root: HTMLElement, runtime: ShellRuntime, event: SelectionSyncEvent): void {
  const revision = event.revision ?? createRevision(event.sourceWindowId);
  runtime.selectedPartId = event.selectedPartId;
  runtime.selectedPartTitle = event.selectedPartTitle;
  updateContextState(runtime, registerTab(runtime.contextState, {
    tabId: event.selectedPartId,
    groupId: getTabGroupId(runtime.contextState, event.selectedPartId) ?? DEFAULT_GROUP_ID,
    groupColor: DEFAULT_GROUP_COLOR,
  }));
  updateContextState(runtime, setActiveTab(runtime.contextState, event.selectedPartId));
  writeGlobalSelectionLane(runtime, {
    selectedPartId: event.selectedPartId,
    selectedPartTitle: event.selectedPartTitle,
    revision,
  });

  const selectionPropagation = applySelectionPropagation(runtime, event, revision);
  updateContextState(runtime, selectionPropagation.state);

  if (selectionPropagation.derivedLaneFailures.length > 0) {
    runtime.notice = `Derived lane failures: ${selectionPropagation.derivedLaneFailures.join(", ")}`;
  }

  renderParts(root, runtime);
  updateSelectedStyles(root, runtime.selectedPartId);
  renderSyncStatus(root, runtime);
  announce(root, runtime, formatSelectionAnnouncement({
    selectedPartTitle: runtime.selectedPartTitle,
    selectedEntitySummary: summarizeSelectionPriorities(runtime),
  }));
}

function applyContext(root: HTMLElement, runtime: ShellRuntime, event: ContextSyncEvent): void {
  const revision = event.revision ?? createRevision(event.sourceWindowId);
  if (event.scope === "global") {
    updateContextState(runtime, writeGlobalLane(runtime.contextState, {
      key: event.contextKey,
      value: event.contextValue,
      revision,
    }));
  } else if (event.groupId) {
    updateContextState(runtime, writeGroupLaneByGroup(runtime.contextState, {
      groupId: event.groupId,
      key: event.contextKey,
      value: event.contextValue,
      revision,
    }));
  } else if (event.tabId) {
    updateContextState(runtime, writeGroupLaneByTab(runtime.contextState, {
      tabId: event.tabId,
      key: event.contextKey,
      value: event.contextValue,
      revision,
    }));
  }
  renderContextControlsPanel(root, runtime);
  renderSyncStatus(root, runtime);
  renderCommandSurface(root, runtime);
}

function renderSyncStatus(root: HTMLElement, runtime: ShellRuntime): void {
  renderPanels(root, runtime);
}

function resolveIntentFlow(root: HTMLElement, runtime: ShellRuntime, intent: ShellIntent): void {
  const catalog = createActionCatalogFromRegistrySnapshot(runtime.registry.getSnapshot());
  const resolved = resolveIntentWithTrace(catalog, intent);
  const resolution = resolved.resolution;
  runtime.pendingIntent = intent;
  runtime.lastIntentTrace = resolved.trace;

  if (resolution.kind === "no-match") {
    runtime.pendingIntentMatches = [];
    runtime.chooserFocusIndex = 0;
    runtime.intentNotice = resolution.feedback;
    announce(root, runtime, runtime.intentNotice);
    return;
  }

  if (resolution.kind === "single-match") {
    runtime.pendingIntentMatches = [];
    runtime.chooserFocusIndex = 0;
    announce(root, runtime, resolution.feedback);
    executeResolvedAction(root, runtime, resolution.matches[0], intent);
    return;
  }

  runtime.pendingIntentMatches = resolution.matches;
  runtime.chooserFocusIndex = 0;
  runtime.chooserReturnFocusSelector = resolveEventTargetSelector(root);
  runtime.pendingFocusSelector = "button[data-action='choose-intent-action'][data-intent-index='0']";
  runtime.intentNotice = resolution.feedback;
  announce(root, runtime, `${resolution.feedback} Use arrow keys and Enter to choose an action.`);
}

function renderDevContextInspector(root: HTMLElement, runtime: ShellRuntime): void {
  renderPanels(root, runtime);
}

function executeResolvedAction(
  root: HTMLElement,
  runtime: ShellRuntime,
  match: IntentActionMatch,
  intent: ShellIntent | null,
): void {
  const genericContextValue = intent ? `intent:${intent.type}` : "none";
  writeGroupSelectionContext(runtime, genericContextValue);

  runtime.pendingIntentMatches = [];
  runtime.chooserFocusIndex = 0;
  const restoreSelector = resolveChooserFocusRestoration("execute", runtime.chooserReturnFocusSelector);
  runtime.chooserReturnFocusSelector = null;
  runtime.pendingFocusSelector = restoreSelector;
  runtime.intentNotice = `Executed '${match.title}' via ${match.pluginId}.${match.handler}.`;
  announce(root, runtime, runtime.intentNotice);
  renderParts(root, runtime);
}

function resolveEventTargetSelector(root: HTMLElement): string | null {
  const active = root.ownerDocument?.activeElement;
  if (!(active instanceof HTMLElement)) {
    return null;
  }

  if (active.matches("button[data-action='select']") && active.dataset.partId) {
    return `button[data-action='select'][data-part-id='${active.dataset.partId}']`;
  }

  return null;
}

function renderContextControlsPanel(root: HTMLElement, runtime: ShellRuntime): void {
  renderPanels(root, runtime);
}

function renderCommandSurface(root: HTMLElement, runtime: ShellRuntime): void {
  const node = root.querySelector<HTMLElement>("#command-surface");
  if (!node) {
    return;
  }

  const context = toCommandContext(runtime);
  const menuCommands = runtime.commandSurface.evaluateMenu("sidePanel", context);
  const menuCommandPluginById = new Map(menuCommands.map((item) => [item.command.id, item.command.pluginId]));
  const commandRows = menuCommands
    .map(
      (item) => `<button
        type="button"
        data-command-run="${escapeHtml(item.command.id)}"
        ${item.enabled ? "" : "disabled"}
        style="display:block;width:100%;text-align:left;margin:0 0 6px;background:#1d2635;border:1px solid #334564;border-radius:4px;color:#e9edf3;padding:4px 8px;cursor:pointer;"
      >${escapeHtml(item.command.title)}</button>`,
    )
    .join("");

  const visibleCommands = runtime.commandSurface
    .evaluateCommands(context)
    .filter((item) => item.visible)
    .map((item) => `<li>${escapeHtml(item.command.id)}</li>`)
    .join("");

  node.innerHTML = `<h2>Commands</h2>
    ${runtime.commandNotice ? `<p class="runtime-note">${escapeHtml(runtime.commandNotice)}</p>` : ""}
    ${commandRows || '<p class="runtime-note">No visible command contributions for current context.</p>'}
    <details>
      <summary class="runtime-note" style="cursor:pointer;">Visible commands (debug)</summary>
      <ul class="plugin-diag-list">${visibleCommands || "<li>none</li>"}</ul>
    </details>`;

  for (const button of node.querySelectorAll<HTMLButtonElement>("button[data-command-run]")) {
    button.addEventListener("click", async () => {
      const commandId = button.dataset.commandRun;
      if (!commandId) {
        return;
      }

      const pluginId = menuCommandPluginById.get(commandId);
      if (pluginId) {
        const activated = await activatePluginForBoundary(root, runtime, {
          pluginId,
          triggerType: "command",
          triggerId: commandId,
        });
        if (!activated) {
          runtime.commandNotice = `Command '${commandId}' blocked: plugin '${pluginId}' is not active.`;
          renderCommandSurface(root, runtime);
          return;
        }
      }

      const result = runtime.commandSurface.dispatchCommand(commandId, toCommandContext(runtime));
      runtime.commandNotice = result.message;
      renderCommandSurface(root, runtime);
    });
  }
}

function resolvePluginIdForCommand(runtime: ShellRuntime, commandId: string): string | null {
  return runtime.commandSurface
    .evaluateCommands(toCommandContext(runtime))
    .find((item) => item.command.id === commandId)
    ?.command.pluginId ?? null;
}

async function primeEnabledPluginActivations(root: HTMLElement, runtime: ShellRuntime): Promise<void> {
  const snapshot = runtime.registry.getSnapshot();
  const activations = snapshot.plugins
    .filter((plugin) =>
      plugin.enabled
      && plugin.lifecycle.state !== "active"
      && plugin.lifecycle.state !== "activating"
      && plugin.lifecycle.state !== "failed"
    )
    .map((plugin) =>
      activatePluginForBoundary(root, runtime, {
        pluginId: plugin.id,
        triggerType: "view",
        triggerId: "shell.render",
      })
    );

  if (activations.length === 0) {
    return;
  }

  await Promise.all(activations);
  refreshCommandContributions(runtime);
  renderPanels(root, runtime);
  renderParts(root, runtime);
  renderCommandSurface(root, runtime);
}

async function activatePluginForBoundary(
  root: HTMLElement,
  runtime: ShellRuntime,
  options: {
    pluginId: string;
    triggerType: PluginActivationTriggerType;
    triggerId: string;
  },
): Promise<boolean> {
  try {
    const activated =
      options.triggerType === "command"
        ? await runtime.registry.activateByCommand(options.pluginId, options.triggerId)
        : options.triggerType === "intent"
          ? await runtime.registry.activateByIntent(options.pluginId, options.triggerId)
          : await runtime.registry.activateByView(options.pluginId, options.triggerId);

    if (!activated) {
      runtime.notice = `Plugin '${options.pluginId}' is not active for ${options.triggerType}:${options.triggerId}.`;
      renderSyncStatus(root, runtime);
      return false;
    }

    runtime.notice = "";
    refreshCommandContributions(runtime);
    renderPanels(root, runtime);
    return true;
  } catch (error) {
    runtime.notice = `Plugin activation failed for '${options.pluginId}' (${options.triggerType}:${options.triggerId}).`;
    renderSyncStatus(root, runtime);
    console.warn("[shell] plugin activation boundary failed", options, error);
    return false;
  }
}

function toCommandContext(runtime: ShellRuntime): Record<string, string> {
  const context: Record<string, string> = {
    [CORE_GROUP_CONTEXT_KEY]: readGroupSelectionContext(runtime),
    "context.domain.selection": readGroupSelectionContext(runtime),
  };

  if (runtime.selectedPartId) {
    context["selection.partId"] = runtime.selectedPartId;
  }

  const orderPriorityId = runtime.contextState.selectionByEntityType.order?.priorityId;
  if (orderPriorityId) {
    context["selection.orderId"] = orderPriorityId;
  }

  const vesselPriorityId = runtime.contextState.selectionByEntityType.vessel?.priorityId;
  if (vesselPriorityId) {
    context["selection.vesselId"] = vesselPriorityId;
  }

  return context;
}

function summarizeSelectionPriorities(runtime: ShellRuntime): string {
  const entries = Object.entries(runtime.contextState.selectionByEntityType)
    .map(([entityType, selection]) => `${entityType}:${selection.priorityId ?? "none"}`);
  return entries.length > 0 ? entries.join(", ") : "none";
}

function applyLayout(root: HTMLElement, layout: ShellLayoutState): void {
  root.style.setProperty("--side-size", `${Math.round(layout.sideSize * 100)}vw`);
  root.style.setProperty("--secondary-size", `${Math.round(layout.secondarySize * 100)}vh`);
}

function setupResize(root: HTMLElement, runtime: ShellRuntime): void {
  const sideSplitter = root.querySelector<HTMLElement>("#splitter-side");
  const secondarySplitter = root.querySelector<HTMLElement>("#splitter-secondary");

  if (sideSplitter) {
    registerDrag(sideSplitter, (delta) => {
      runtime.layout = applyPaneResize(runtime.layout, {
        pane: "side",
        deltaPx: delta,
        containerPx: window.innerWidth,
      });
      applyLayout(root, runtime.layout);
      runtime.persistence.save(runtime.layout);
    });
  }

  if (secondarySplitter) {
    registerDrag(secondarySplitter, (delta) => {
      runtime.layout = applyPaneResize(runtime.layout, {
        pane: "secondary",
        deltaPx: -delta,
        containerPx: window.innerHeight,
      });
      applyLayout(root, runtime.layout);
      runtime.persistence.save(runtime.layout);
    });
  }
}

function registerDrag(splitter: HTMLElement, onDelta: (delta: number) => void): void {
  splitter.addEventListener("pointerdown", (event) => {
    splitter.setPointerCapture(event.pointerId);
    let previous = axisValue(event, splitter.dataset.pane);

    const onMove = (moveEvent: PointerEvent) => {
      const current = axisValue(moveEvent, splitter.dataset.pane);
      onDelta(current - previous);
      previous = current;
    };

    const onUp = () => {
      splitter.removeEventListener("pointermove", onMove);
      splitter.removeEventListener("pointerup", onUp);
      splitter.removeEventListener("pointercancel", onUp);
    };

    splitter.addEventListener("pointermove", onMove);
    splitter.addEventListener("pointerup", onUp);
    splitter.addEventListener("pointercancel", onUp);
  });
}

function axisValue(event: PointerEvent, pane: string | undefined): number {
  return pane === "secondary" ? event.clientY : event.clientX;
}

function normalizeKeyEvent(event: KeyboardEvent): string | null {
  const key = event.key.toLowerCase();
  if (!key || key === "shift" || key === "control" || key === "alt" || key === "meta") {
    return null;
  }

  const parts: string[] = [];
  if (event.ctrlKey) {
    parts.push("ctrl");
  }
  if (event.shiftKey) {
    parts.push("shift");
  }
  if (event.altKey) {
    parts.push("alt");
  }
  if (event.metaKey) {
    parts.push("meta");
  }
  parts.push(key);

  return parts.join("+");
}

function announce(root: HTMLElement, runtime: ShellRuntime, message: string): void {
  runtime.announcement = message;
  const node = root.querySelector<HTMLElement>("#live-announcer");
  if (!node) {
    return;
  }
  node.textContent = message;
}

function publishWithDegrade(
  root: HTMLElement,
  runtime: ShellRuntime,
  event: Parameters<ShellRuntime["bridge"]["publish"]>[0],
): boolean {
  return publishWithDegradeState(runtime, event, {
    announce: (message) => announce(root, runtime, message),
    updateWindowReadOnlyState: () => updateWindowReadOnlyState(root, runtime),
    renderSyncStatus: () => renderSyncStatus(root, runtime),
    renderContextControls: () => renderContextControlsPanel(root, runtime),
  });
}

function requestSyncProbe(root: HTMLElement, runtime: ShellRuntime): void {
  requestSyncProbeState(runtime, {
    announce: (message) => announce(root, runtime, message),
    updateWindowReadOnlyState: () => updateWindowReadOnlyState(root, runtime),
    renderSyncStatus: () => renderSyncStatus(root, runtime),
    renderContextControls: () => renderContextControlsPanel(root, runtime),
  }, createWindowId);
}

function handleSyncProbe(
  runtime: ShellRuntime,
  event: Parameters<ShellRuntime["bridge"]["subscribe"]>[0] extends (event: infer T) => void ? T : never,
): void {
  if (event.type !== "sync-probe") {
    return;
  }
  handleSyncProbeState(runtime, event);
}

function handleSyncAck(
  root: HTMLElement,
  runtime: ShellRuntime,
  event: Parameters<ShellRuntime["bridge"]["subscribe"]>[0] extends (event: infer T) => void ? T : never,
): boolean {
  if (event.type !== "sync-ack") {
    return false;
  }
  return handleSyncAckState(runtime, event, {
    announce: (message) => announce(root, runtime, message),
    updateWindowReadOnlyState: () => updateWindowReadOnlyState(root, runtime),
    renderSyncStatus: () => renderSyncStatus(root, runtime),
    renderContextControls: () => renderContextControlsPanel(root, runtime),
  });
}
