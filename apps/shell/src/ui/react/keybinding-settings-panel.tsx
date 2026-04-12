import { useCallback, useEffect, useRef, useState } from "react";
import type { KeybindingOverrideManager } from "../../shell-runtime/keybinding-override-manager.js";
import type { ActionKeybinding } from "../../action-surface.js";
import type { KeybindingOverrideEntryV1 } from "../../persistence/contracts.js";
import { normalizeKeyboardEventChord } from "../../shell-runtime/keybinding-normalizer.js";
import { isBrowserSafeDefaultKeybinding } from "../../shell-runtime/default-shell-keybindings.js";
import { downloadKeybindingExport, readKeybindingImportFile } from "../../shell-runtime/keybinding-import-export.js";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface KeybindingsSettingsPanelProps {
  manager: KeybindingOverrideManager;
  pluginBindings: readonly ActionKeybinding[];
  onChanged: () => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sectionStyle: React.CSSProperties = { marginBottom: 16 };
const headingStyle: React.CSSProperties = { margin: "0 0 8px", fontSize: 14, color: "var(--ghost-foreground)" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const thStyle: React.CSSProperties = { textAlign: "left", padding: "4px 8px", borderBottom: "1px solid var(--ghost-border)", color: "var(--ghost-muted-foreground)" };
const tdStyle: React.CSSProperties = { padding: "4px 8px", borderBottom: "1px solid var(--ghost-surface-elevated)", color: "var(--ghost-foreground)" };
const badgeBase: React.CSSProperties = { display: "inline-block", padding: "1px 6px", borderRadius: 3, fontSize: 10, marginLeft: 4 };
const btnStyle: React.CSSProperties = {
  background: "var(--ghost-surface-elevated)", border: "1px solid var(--ghost-border)", borderRadius: 4,
  color: "var(--ghost-foreground)", padding: "2px 8px", cursor: "pointer", fontSize: 11,
};
const recordBtnStyle: React.CSSProperties = { ...btnStyle, background: "var(--ghost-primary)", color: "var(--ghost-input)" };
const conflictBadge: React.CSSProperties = { ...badgeBase, background: "var(--ghost-error)", color: "var(--ghost-error-foreground)" };
const layerBadge = (layer: string): React.CSSProperties => ({
  ...badgeBase,
  background: layer === "user-overrides" ? "var(--ghost-success-background)" : layer === "plugins" ? "var(--ghost-info-background)" : "var(--ghost-neutral-background)",
  color: layer === "user-overrides" ? "var(--ghost-success-foreground)" : layer === "plugins" ? "var(--ghost-info-foreground)" : "var(--ghost-muted-foreground)",
});
const dangerBtnStyle: React.CSSProperties = {
  ...btnStyle, marginTop: 12, background: "var(--ghost-error-background)", border: "1px solid var(--ghost-error)", color: "var(--ghost-error-foreground)",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KeybindingsSettingsPanel(props: KeybindingsSettingsPanelProps) {
  const { manager, onChanged } = props;
  const [recordingAction, setRecordingAction] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const recordRef = useRef<HTMLInputElement>(null);

  const defaults = manager.getDefaultBindings();
  const plugins = manager.getPluginBindings();
  const overrides = manager.getOverrides();
  const overrideMap = new Map(overrides.map((o) => [o.action, o]));

  const hasConflict = useCallback((chord: string): boolean => {
    return manager.listConflicts(chord).length > 1;
  }, [manager]);

  const handleRecord = useCallback((action: string) => {
    setRecordingAction(action);
    setWarning(null);
  }, []);

  const handleCancelRecord = useCallback(() => {
    setRecordingAction(null);
    setWarning(null);
  }, []);

  useEffect(() => {
    if (recordingAction && recordRef.current) {
      recordRef.current.focus();
    }
  }, [recordingAction]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const chord = normalizeKeyboardEventChord(event.nativeEvent);
    if (!chord) {
      return;
    }

    if (!isBrowserSafeDefaultKeybinding(chord.value)) {
      setWarning(`"${chord.value}" is reserved by the browser and cannot be bound.`);
      setRecordingAction(null);
      return;
    }

    const result = manager.addOverride(recordingAction!, chord.value);
    if (result.warning) {
      setWarning(result.warning);
    } else if (result.conflicts.length > 0) {
      setWarning(`Conflict: ${result.conflicts.map((c) => c.action).join(", ")}`);
    }
    setRecordingAction(null);
    onChanged();
  }, [manager, recordingAction, onChanged]);

  const handleRemove = useCallback((action: string) => {
    manager.removeOverride(action);
    setWarning(null);
    onChanged();
  }, [manager, onChanged]);

  const handleResetAll = useCallback(() => {
    manager.resetToDefaults();
    setWarning(null);
    setImportStatus(null);
    onChanged();
  }, [manager, onChanged]);

  const handleExport = useCallback(() => {
    const envelope = manager.exportOverrides();
    downloadKeybindingExport(envelope);
  }, [manager]);

  const handleImport = useCallback(async () => {
    try {
      const data = await readKeybindingImportFile();
      const result = manager.importOverrides(data);
      if (!result.success) {
        setImportStatus(`Import failed: ${result.errors.join("; ")}`);
        return;
      }
      const count = result.entries.length;
      if (result.warnings.length > 0) {
        setImportStatus(`Imported ${count} override(s) (warnings: ${result.warnings.join("; ")})`);
      } else {
        setImportStatus(`Imported ${count} override(s)`);
      }
      onChanged();
    } catch {
      setImportStatus("Import cancelled or file unreadable.");
    }
  }, [manager, onChanged]);

  return (
    <section aria-label="Keybinding settings" style={{ padding: 8, background: "var(--ghost-background)", color: "var(--ghost-foreground)" }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 16, color: "var(--ghost-foreground)" }}>Keybinding Settings</h2>

      {warning ? (
        <div role="alert" style={{ padding: "4px 8px", marginBottom: 8, background: "var(--ghost-error-background)", border: "1px solid var(--ghost-error)", borderRadius: 4, fontSize: 12, color: "var(--ghost-error-foreground)" }}>
          {warning}
        </div>
      ) : null}

      <BindingSection
        title="User overrides"
        layer="user-overrides"
        bindings={overrides.map((o) => ({ action: o.action, keybinding: o.keybinding, pluginId: "user.override" }))}
        hasConflict={hasConflict}
        recordingAction={recordingAction}
        recordRef={recordRef}
        onRecord={handleRecord}
        onCancelRecord={handleCancelRecord}
        onKeyDown={handleKeyDown}
        onRemove={handleRemove}
        editable
      />

      <BindingSection
        title="Plugin bindings"
        layer="plugins"
        bindings={plugins as ActionKeybinding[]}
        hasConflict={hasConflict}
        recordingAction={null}
        recordRef={recordRef}
        onRecord={handleRecord}
        onCancelRecord={handleCancelRecord}
        onKeyDown={handleKeyDown}
        showPluginId
      />

      <BindingSection
        title="Default bindings"
        layer="defaults"
        bindings={defaults}
        hasConflict={hasConflict}
        recordingAction={recordingAction}
        recordRef={recordRef}
        onRecord={handleRecord}
        onCancelRecord={handleCancelRecord}
        onKeyDown={handleKeyDown}
        overrideMap={overrideMap}
        allowOverride
      />

      <div style={sectionStyle}>
        <h3 style={headingStyle}>Import / Export</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleExport} style={btnStyle} type="button" aria-label="Export keybinding overrides as JSON">
            Export JSON
          </button>
          <button onClick={handleImport} style={btnStyle} type="button" aria-label="Import keybinding overrides from JSON file">
            Import JSON
          </button>
        </div>
        {importStatus ? (
           <div role="alert" style={{ marginTop: 6, fontSize: 11, color: "var(--ghost-muted-foreground)" }}>
            {importStatus}
          </div>
        ) : null}
      </div>

      {overrides.length > 0 ? (
        <button onClick={handleResetAll} style={dangerBtnStyle} type="button">
          Reset all overrides
        </button>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface BindingSectionProps {
  title: string;
  layer: string;
  bindings: readonly ActionKeybinding[];
  hasConflict: (chord: string) => boolean;
  recordingAction: string | null;
  recordRef: React.RefObject<HTMLInputElement>;
  onRecord: (action: string) => void;
  onCancelRecord: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onRemove?: (action: string) => void;
  editable?: boolean;
  showPluginId?: boolean;
  allowOverride?: boolean;
  overrideMap?: Map<string, KeybindingOverrideEntryV1>;
}

function BindingSection(props: BindingSectionProps) {
  const {
    title, layer, bindings, hasConflict, recordingAction,
    recordRef, onRecord, onCancelRecord, onKeyDown,
    onRemove, editable, showPluginId, allowOverride, overrideMap,
  } = props;

  if (bindings.length === 0) {
    return <div style={sectionStyle}><h3 style={headingStyle}>{title}</h3><p style={{ margin: 0, fontSize: 12, color: "var(--ghost-muted-foreground)" }}>None</p></div>;
  }

  return (
    <div style={sectionStyle}>
      <h3 style={headingStyle}>{title}</h3>
      <table style={tableStyle}>
        <thead><tr>
          <th style={thStyle}>Action</th><th style={thStyle}>Chord</th><th style={thStyle}>Source</th>
          {showPluginId ? <th style={thStyle}>Plugin</th> : null}<th style={thStyle}>Actions</th>
        </tr></thead>
        <tbody>
          {bindings.map((binding) => {
            const isRecording = recordingAction === binding.action;
            const conflict = hasConflict(binding.keybinding);
            const alreadyOverridden = overrideMap?.has(binding.action) ?? false;
            return (
              <tr key={`${layer}-${binding.action}`}>
                <td style={tdStyle}>{binding.action}</td>
                <td style={tdStyle}>
                  {isRecording ? (
                    <span aria-live="assertive">
                      <input ref={recordRef} aria-label={`Recording keybinding for ${binding.action}`} onBlur={onCancelRecord} onKeyDown={onKeyDown} placeholder="Press keys..." readOnly style={{ background: "var(--ghost-input)", border: "1px solid var(--ghost-primary)", color: "var(--ghost-foreground)", padding: "2px 4px", width: 120, fontSize: 11 }} />
                    </span>
                  ) : <code style={{ fontSize: 11 }}>{binding.keybinding}</code>}
                  {conflict && !isRecording ? <span style={conflictBadge}>conflict</span> : null}
                </td>
                <td style={tdStyle}><span style={layerBadge(layer)}>{layer}</span></td>
                {showPluginId ? <td style={tdStyle}><span style={{ fontSize: 10, color: "var(--ghost-muted-foreground)" }}>{binding.pluginId}</span></td> : null}
                <td style={tdStyle}>
                  <BindingActions action={binding.action} editable={editable} allowOverride={allowOverride} alreadyOverridden={alreadyOverridden} isRecording={isRecording} onRecord={onRecord} onCancelRecord={onCancelRecord} onRemove={onRemove} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface BindingActionsProps {
  action: string; editable?: boolean; allowOverride?: boolean; alreadyOverridden: boolean;
  isRecording: boolean; onRecord: (action: string) => void; onCancelRecord: () => void; onRemove?: (action: string) => void;
}

function BindingActions(props: BindingActionsProps) {
  const { action, editable, allowOverride, alreadyOverridden, isRecording, onRecord, onCancelRecord, onRemove } = props;
  if (isRecording) {
    return <button onClick={onCancelRecord} style={btnStyle} type="button">Cancel</button>;
  }
  return (
    <>
      {(editable || allowOverride) && !alreadyOverridden ? (
        <button aria-label={`Record new keybinding for ${action}`} onClick={() => onRecord(action)} style={recordBtnStyle} type="button">
          {allowOverride ? "Override" : "Record"}
        </button>
      ) : null}
      {editable && onRemove ? (
        <button aria-label={`Reset keybinding for ${action}`} onClick={() => onRemove(action)} style={{ ...btnStyle, marginLeft: 4 }} type="button">Reset</button>
      ) : null}
      {alreadyOverridden ? <span style={{ fontSize: 10, color: "var(--ghost-muted-foreground)", marginLeft: 4 }}>overridden</span> : null}
    </>
  );
}
