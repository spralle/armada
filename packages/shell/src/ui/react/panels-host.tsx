import type { IntentActionMatch } from "@ghost-shell/intents";
import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ShellRuntime } from "../../app/types.js";
import { toPrettyJson } from "../../app/utils.js";
import {
  CORE_GLOBAL_SELECTION_KEY,
  CORE_GROUP_CONTEXT_KEY,
  collectLaneMetadata,
  readGlobalContext,
  readGroupSelectionContext,
} from "../../context/runtime-state.js";
import { getBridgeWarningMessage } from "../../sync/bridge-degraded.js";
import { applyPendingFocus } from "../pending-focus.js";

type PanelsHostBindings = {
  onApplyContextValue: (value: string) => void;
  onChooseIntentAction: (index: number) => void;
  onDismissChooser: () => void;
  onPendingFocusApplied: () => void;
};

type PanelsHost = {
  render: () => void;
  unmount: () => void;
};

interface PanelsHostRootEntry {
  container: HTMLElement;
  root: Root;
}

export function createReactPanelsHost(
  rootNode: HTMLElement,
  runtime: ShellRuntime,
  bindings: PanelsHostBindings,
): PanelsHost {
  const roots = new Map<string, PanelsHostRootEntry>();

  const ensureRoot = (containerId: string): Root | null => {
    const container = rootNode.querySelector<HTMLElement>(`#${containerId}`);
    if (!container) return null;
    const existing = roots.get(containerId);
    if (existing && existing.container === container) return existing.root;
    if (existing) {
      existing.root.unmount();
      roots.delete(containerId);
    }
    const createdRoot = createRoot(container);
    roots.set(containerId, { container, root: createdRoot });
    return createdRoot;
  };

  const host: PanelsHost = {
    render() {
      const syncRoot = ensureRoot("sync-status");
      if (syncRoot) {
        syncRoot.render(
          <SyncStatusPanel
            chooserFocusIndex={runtime.activeIntentSession?.chooserFocusIndex ?? 0}
            chooserMatches={runtime.activeIntentSession?.matches ?? []}
            globalContext={readGlobalContext(runtime)}
            groupContext={readGroupSelectionContext(runtime)}
            intentNotice={runtime.intentNotice}
            notice={runtime.notice}
            selectionPriorities={
              Object.entries(runtime.contextState.selectionByEntityType)
                .map(([et, s]) => `${et}:${s.priorityId ?? "none"}`)
                .join(", ") || "none"
            }
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
      for (const entry of roots.values()) {
        entry.root.unmount();
      }
      roots.clear();
    },
  };

  return host;
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
    applyPendingFocus(props.rootNode, props.pendingFocusSelector, props.onPendingFocusApplied);
  }, [props.pendingFocusSelector, props.rootNode, props.onPendingFocusApplied]);

  return (
    <>
      <h2>Cross-window sync</h2>
      {props.warningMessage ? <div className="bridge-warning">{props.warningMessage}</div> : null}
      <p className="runtime-note">
        <strong>Selected part:</strong> {props.selectedPartTitle ?? "none"}
      </p>
      <p className="runtime-note">
        <strong>Selection priorities:</strong> {props.selectionPriorities}
      </p>
      <p className="runtime-note">
        <strong>Group context:</strong> {CORE_GROUP_CONTEXT_KEY} = {props.groupContext}
      </p>
      <p className="runtime-note">
        <strong>Global lane:</strong> {CORE_GLOBAL_SELECTION_KEY} = {props.globalContext}
      </p>
      <p className="runtime-note">
        <strong>Window ID:</strong> {props.windowId}
      </p>
      {props.intentNotice ? (
        <p className="runtime-note">
          <strong>Intent runtime:</strong> {props.intentNotice}
        </p>
      ) : null}
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
          <button onClick={props.onDismiss} style={{ marginTop: 6, width: "100%" }} type="button">
            Dismiss chooser
          </button>
        </section>
      ) : null}
      {props.notice ? <p className="runtime-note">{props.notice}</p> : null}
    </>
  );
}

function DevContextInspectorPanel(props: {
  contextState: ShellRuntime["contextState"];
  laneMetadata: ReturnType<typeof collectLaneMetadata>;
  trace: ShellRuntime["lastIntentTrace"];
}) {
  return (
    <div className="dev-inspector">
      <h2>Dev context inspector</h2>
      <p className="runtime-note">
        <strong>Mode:</strong> development only
      </p>
      <p className="runtime-note">
        <strong>Intent trace:</strong>{" "}
        {props.trace ? `${props.trace.intentType} (${props.trace.matched.length} matches)` : "none yet"}
      </p>
      <details>
        <summary>Current context snapshot</summary>
        <pre>{toPrettyJson(props.contextState)}</pre>
      </details>
      <details>
        <summary>Revision/source metadata</summary>
        <ul>
          {props.laneMetadata.length > 0 ? (
            props.laneMetadata.map((item) => (
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
            ))
          ) : (
            <li>No lanes written yet.</li>
          )}
        </ul>
      </details>
      <details>
        <summary>Intent/action matching traces</summary>
        {props.trace ? (
          props.trace.actions.map((action) => (
            <details key={`${action.pluginId}.${action.actionId}`}>
              <summary>
                {action.pluginId}.{action.actionId} —{" "}
                {action.intentTypeMatch && action.predicateMatched ? "matched" : "not matched"}
              </summary>
              {action.failedPredicates.length > 0 ? (
                <pre>{toPrettyJson(action.failedPredicates)}</pre>
              ) : (
                <p className="runtime-note">No predicate failures.</p>
              )}
            </details>
          ))
        ) : (
          <p className="runtime-note">No intent evaluations recorded.</p>
        )}
        {props.trace ? (
          <p className="runtime-note">
            <strong>Matched actions:</strong>{" "}
            {props.trace.matched.map((item) => `${item.pluginId}.${item.actionId}`).join(", ") || "none"}
          </p>
        ) : null}
      </details>
    </div>
  );
}
