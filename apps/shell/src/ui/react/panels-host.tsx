import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  collectLaneMetadata,
  CORE_GLOBAL_SELECTION_KEY,
  CORE_GROUP_CONTEXT_KEY,
  readGlobalContext,
  readGroupSelectionContext,
} from "../../context/runtime-state.js";
import { getBridgeWarningMessage } from "../../sync/bridge-degraded.js";
import type { IntentActionMatch } from "../../intent-runtime.js";
import type { ShellRuntime } from "../../app/types.js";
import { toPrettyJson } from "../../app/utils.js";

type PanelsHostBindings = {
  onApplyContextValue: (value: string) => void;
  onTogglePlugin: (pluginId: string, enabled: boolean) => Promise<void>;
  onChooseIntentAction: (index: number) => void;
  onDismissChooser: () => void;
  onPendingFocusApplied: () => void;
};

type PanelsHost = {
  render: () => void;
  unmount: () => void;
};

export function createReactPanelsHost(
  rootNode: HTMLElement,
  runtime: ShellRuntime,
  bindings: PanelsHostBindings,
): PanelsHost {
  const roots = new Map<string, Root>();

  const ensureRoot = (containerId: string): Root | null => {
    const container = rootNode.querySelector<HTMLElement>(`#${containerId}`);
    if (!container) {
      return null;
    }

    const existing = roots.get(containerId);
    if (existing) {
      return existing;
    }

    const created = createRoot(container);
    roots.set(containerId, created);
    return created;
  };

  return {
    render() {
      const pluginRoot = ensureRoot("plugin-controls");
      if (pluginRoot) {
        pluginRoot.render(
          <PluginControlsPanel
            disabled={runtime.syncDegraded}
            notice={runtime.pluginNotice}
            snapshot={runtime.registry.getSnapshot()}
            onToggle={bindings.onTogglePlugin}
          />,
        );
      }

      const syncRoot = ensureRoot("sync-status");
      if (syncRoot) {
        syncRoot.render(
          <SyncStatusPanel
            chooserFocusIndex={runtime.chooserFocusIndex}
            chooserMatches={runtime.pendingIntentMatches}
            globalContext={readGlobalContext(runtime)}
            groupContext={readGroupSelectionContext(runtime)}
            intentNotice={runtime.intentNotice}
            notice={runtime.notice}
            selectionPriorities={readSelectionPriorities(runtime)}
            pendingFocusSelector={runtime.pendingFocusSelector}
            selectedPartTitle={runtime.selectedPartTitle}
            warningMessage={getBridgeWarningMessage(runtime)}
            windowId={runtime.windowId}
            rootNode={rootNode}
            onChoose={bindings.onChooseIntentAction}
            onDismiss={bindings.onDismissChooser}
            onPendingFocusApplied={bindings.onPendingFocusApplied}
          />,
        );
      }

      const contextRoot = ensureRoot("context-controls");
      if (contextRoot) {
        contextRoot.render(
          <ContextControlsPanel
            disabled={runtime.syncDegraded}
            value={readGroupSelectionContext(runtime)}
            onApply={bindings.onApplyContextValue}
          />,
        );
      }

      const inspectorRoot = ensureRoot("dev-context-inspector");
      if (inspectorRoot) {
        inspectorRoot.render(
          <DevContextInspectorPanel
            contextState={runtime.contextState}
            laneMetadata={collectLaneMetadata(runtime.contextState)}
            trace={runtime.lastIntentTrace}
          />,
        );
      }
    },
    unmount() {
      for (const root of roots.values()) {
        root.unmount();
      }
      roots.clear();
    },
  };
}

function PluginControlsPanel(props: {
  snapshot: ReturnType<ShellRuntime["registry"]["getSnapshot"]>;
  notice: string;
  disabled: boolean;
  onToggle: (pluginId: string, enabled: boolean) => Promise<void>;
}) {
  const loadedContracts = props.snapshot.plugins
    .filter((plugin) => plugin.contract !== null)
    .map((plugin) => plugin.contract?.manifest.name ?? plugin.id)
    .join(", ");

  return (
    <>
      <h2>Plugins ({props.snapshot.tenantId})</h2>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "#c6d0e0" }}>Loaded: {loadedContracts || "none"}</p>
      {props.notice ? <p className="plugin-notice">{props.notice}</p> : null}
      {props.snapshot.plugins.length === 0 ? (
        <p style={{ margin: 0, color: "#c6d0e0" }}>No registered plugin descriptors.</p>
      ) : (
        props.snapshot.plugins.map((plugin) => (
          <label className="plugin-row" key={plugin.id}>
            <input
              checked={plugin.enabled}
              data-plugin-toggle={plugin.id}
              disabled={props.disabled}
              onChange={(event) => {
                void props.onToggle(plugin.id, event.currentTarget.checked);
              }}
              type="checkbox"
            />
            <strong>{plugin.id}</strong> <small>({plugin.loadMode})</small>
            {plugin.failure ? (
              <p className="plugin-error">{plugin.failure.code}: {plugin.failure.message}</p>
            ) : null}
          </label>
        ))
      )}
      {props.snapshot.diagnostics.length > 0 ? (
        <details>
          <summary style={{ cursor: "pointer", fontSize: 12, color: "#c6d0e0" }}>Diagnostics (dev/demo)</summary>
          <ul className="plugin-diag-list">
            {props.snapshot.diagnostics.slice(0, 5).map((item) => (
              <li key={`${item.at}:${item.code}:${item.pluginId}`}>
                <strong>{item.code}</strong> [{item.level}] {item.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

function SyncStatusPanel(props: {
  warningMessage: string | null;
  selectedPartTitle: string | null;
  selectionPriorities: string;
  groupContext: string;
  globalContext: string;
  windowId: string;
  notice: string;
  intentNotice: string;
  chooserMatches: IntentActionMatch[];
  chooserFocusIndex: number;
  pendingFocusSelector: string | null;
  rootNode: HTMLElement;
  onChoose: (index: number) => void;
  onDismiss: () => void;
  onPendingFocusApplied: () => void;
}) {
  useEffect(() => {
    if (!props.pendingFocusSelector) {
      return;
    }

    const node = props.rootNode.querySelector<HTMLElement>(props.pendingFocusSelector);
    if (node) {
      node.focus();
    }

    props.onPendingFocusApplied();
  }, [props.pendingFocusSelector, props.rootNode, props.onPendingFocusApplied]);

  return (
    <>
      <h2>Cross-window sync</h2>
      {props.warningMessage ? <div className="bridge-warning">{props.warningMessage}</div> : null}
      <p className="runtime-note"><strong>Selected part:</strong> {props.selectedPartTitle ?? "none"}</p>
      <p className="runtime-note"><strong>Selection priorities:</strong> {props.selectionPriorities}</p>
      <p className="runtime-note"><strong>Group context:</strong> {CORE_GROUP_CONTEXT_KEY} = {props.groupContext}</p>
      <p className="runtime-note"><strong>Global lane:</strong> {CORE_GLOBAL_SELECTION_KEY} = {props.globalContext}</p>
      <p className="runtime-note"><strong>Window ID:</strong> {props.windowId}</p>
      {props.intentNotice ? <p className="runtime-note"><strong>Intent runtime:</strong> {props.intentNotice}</p> : null}
      {props.chooserMatches.length > 0 ? (
        <section aria-label="Intent action chooser" className="intent-chooser">
          <h3 style={{ margin: "0 0 6px" }}>Choose action</h3>
          <div aria-label="Available actions" role="listbox">
            {props.chooserMatches.map((match, index) => (
              <button
                aria-selected={index === props.chooserFocusIndex ? "true" : "false"}
                data-action="choose-intent-action"
                data-intent-index={index}
                key={`${match.pluginId}.${match.actionId}`}
                onClick={() => {
                  props.onChoose(index);
                }}
                role="option"
                type="button"
              >
                {match.title} <small>({match.pluginName})</small>
              </button>
            ))}
          </div>
          <button
            onClick={props.onDismiss}
            style={{ marginTop: 6, width: "100%" }}
            type="button"
          >
            Dismiss chooser
          </button>
        </section>
      ) : null}
      {props.notice ? <p className="runtime-note">{props.notice}</p> : null}
    </>
  );
}

function ContextControlsPanel(props: {
  value: string;
  disabled: boolean;
  onApply: (value: string) => void;
}) {
  const [inputValue, setInputValue] = useState(props.value);

  useEffect(() => {
    setInputValue(props.value);
  }, [props.value]);

  const apply = () => {
    props.onApply(inputValue.trim() || "none");
  };

  return (
    <>
      <h2>Group context</h2>
      <label className="runtime-note" htmlFor="context-value-input">{CORE_GROUP_CONTEXT_KEY}</label>
      <input
        id="context-value-input"
        onChange={(event) => {
          setInputValue(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            apply();
          }
        }}
        style={{ width: "100%", boxSizing: "border-box", margin: "6px 0", padding: 4, background: "#0f1319", border: "1px solid #334564", color: "#e9edf3" }}
        value={inputValue}
      />
      <button
        disabled={props.disabled}
        id="context-apply"
        onClick={apply}
        style={{ background: "#1d2635", border: "1px solid #334564", borderRadius: 4, color: "#e9edf3", padding: "4px 8px", cursor: "pointer" }}
        type="button"
      >
        Apply + sync
      </button>
    </>
  );
}

function DevContextInspectorPanel(props: {
  contextState: ShellRuntime["contextState"];
  laneMetadata: ReturnType<typeof collectLaneMetadata>;
  trace: ShellRuntime["lastIntentTrace"];
}) {
  return (
    <>
      <h2>Dev context inspector</h2>
      <p className="runtime-note"><strong>Mode:</strong> development only</p>
      <p className="runtime-note">
        <strong>Intent trace:</strong> {props.trace ? `${props.trace.intentType} (${props.trace.matched.length} matches)` : "none yet"}
      </p>
      <details>
        <summary>Current context snapshot</summary>
        <pre>{toPrettyJson(props.contextState)}</pre>
      </details>
      <details>
        <summary>Revision/source metadata</summary>
        <ul>
          {props.laneMetadata.length > 0 ? props.laneMetadata.map((item) => (
            <li key={`${item.scope}:${item.key}:${item.revision.timestamp}:${item.revision.writer}`}>
              <strong>{item.scope}</strong> {item.key} = {item.value}
              <br />
              <small>
                revision={item.revision.timestamp}:{item.revision.writer}
                {item.sourceSelection
                  ? ` | source=${item.sourceSelection.entityType}@${item.sourceSelection.revision.timestamp}:${item.sourceSelection.revision.writer}`
                  : ""}
              </small>
            </li>
          )) : <li>No lanes written yet.</li>}
        </ul>
      </details>
      <details>
        <summary>Intent/action matching traces</summary>
        {props.trace ? props.trace.actions.map((action) => (
          <details key={`${action.pluginId}.${action.actionId}`}>
            <summary>
              {action.pluginId}.{action.actionId} — {action.intentTypeMatch && action.predicateMatched ? "matched" : "not matched"}
            </summary>
            {action.failedPredicates.length > 0 ? <pre>{toPrettyJson(action.failedPredicates)}</pre> : <p className="runtime-note">No predicate failures.</p>}
          </details>
        )) : <p className="runtime-note">No intent evaluations recorded.</p>}
        {props.trace ? (
          <p className="runtime-note">
            <strong>Matched actions:</strong> {props.trace.matched.map((item) => `${item.pluginId}.${item.actionId}`).join(", ") || "none"}
          </p>
        ) : null}
      </details>
    </>
  );
}

function readSelectionPriorities(runtime: ShellRuntime): string {
  const entries = Object.entries(runtime.contextState.selectionByEntityType)
    .map(([entityType, selection]) => `${entityType}:${selection.priorityId ?? "none"}`);
  return entries.length > 0 ? entries.join(", ") : "none";
}
