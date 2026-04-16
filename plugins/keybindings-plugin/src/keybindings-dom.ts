// keybindings-dom.ts — Vanilla DOM rendering for the keybindings settings panel.

import type { KeybindingService, KeybindingEntry, KeybindingOverride } from "@ghost/plugin-contracts";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const PANEL_STYLES = `
  .keybindings-panel { padding: 8px; background: var(--ghost-background); color: var(--ghost-foreground); }
  .keybindings-panel h2 { margin: 0 0 12px; font-size: 16px; color: var(--ghost-foreground); }
  .keybindings-panel h3 { margin: 0 0 8px; font-size: 14px; color: var(--ghost-foreground); }
  .keybindings-section { margin-bottom: 16px; }
  .keybindings-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .keybindings-table th { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--ghost-border); color: var(--ghost-muted-foreground); }
  .keybindings-table td { padding: 4px 8px; border-bottom: 1px solid var(--ghost-surface-elevated); color: var(--ghost-foreground); }
  .keybindings-table code { font-size: 11px; }
  .keybindings-badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; margin-left: 4px; }
  .keybindings-badge-override { background: var(--ghost-success-background); color: var(--ghost-success-foreground); }
  .keybindings-badge-conflict { background: var(--ghost-error); color: var(--ghost-error-foreground); }
  .keybindings-btn {
    background: var(--ghost-surface-elevated); border: 1px solid var(--ghost-border); border-radius: 4px;
    color: var(--ghost-foreground); padding: 2px 8px; cursor: pointer; font-size: 11px;
  }
  .keybindings-btn-primary { background: var(--ghost-primary); color: var(--ghost-input); }
  .keybindings-btn-danger {
    margin-top: 12px; background: var(--ghost-error-background); border: 1px solid var(--ghost-error);
    color: var(--ghost-error-foreground);
  }
  .keybindings-alert {
    padding: 4px 8px; margin-bottom: 8px; background: var(--ghost-error-background);
    border: 1px solid var(--ghost-error); border-radius: 4px; font-size: 12px; color: var(--ghost-error-foreground);
  }
  .keybindings-import-status { margin-top: 6px; font-size: 11px; color: var(--ghost-muted-foreground); }
  .keybindings-record-input {
    background: var(--ghost-input); border: 1px solid var(--ghost-primary); color: var(--ghost-foreground);
    padding: 2px 4px; width: 120px; font-size: 11px;
  }
  .keybindings-unavailable { padding: 12px; color: var(--ghost-muted-foreground); font-size: 13px; }
`;

let styleInjected = false;
function injectStyles(): void {
  if (styleInjected) return;
  const style = document.createElement("style");
  style.textContent = PANEL_STYLES;
  document.head.appendChild(style);
  styleInjected = true;
}

// ---------------------------------------------------------------------------
// Reserved browser shortcuts (copied from shell — small utility, safe to duplicate)
// ---------------------------------------------------------------------------

const RESERVED_BROWSER_SHORTCUTS = new Set([
  "ctrl+w", "ctrl+t", "ctrl+n", "ctrl+l", "ctrl+r", "ctrl+tab", "ctrl+shift+tab",
  "alt+left", "alt+right",
]);

function isBrowserSafe(chord: string): boolean {
  const normalized = chord.toLowerCase();
  if (normalized.includes("meta") || normalized.includes("super")) return false;
  return !RESERVED_BROWSER_SHORTCUTS.has(normalized);
}

// ---------------------------------------------------------------------------
// Chord normalizer (copied from shell — small utility, needed for recording)
// ---------------------------------------------------------------------------

const MODIFIER_ORDER = ["ctrl", "shift", "alt", "meta"] as const;
const KEYBOARD_EVENT_MODIFIERS = new Set(["shift", "control", "alt", "meta"]);
const KEYBINDING_MODIFIERS = new Set(MODIFIER_ORDER);

function normalizeKeyboardEventChord(event: KeyboardEvent): string | null {
  const key = event.key.toLowerCase();
  if (!key || KEYBOARD_EVENT_MODIFIERS.has(key)) return null;
  const mods: string[] = [];
  if (event.ctrlKey) mods.push("ctrl");
  if (event.shiftKey) mods.push("shift");
  if (event.altKey) mods.push("alt");
  if (event.metaKey) mods.push("meta");
  const ordered = MODIFIER_ORDER.filter((m) => KEYBINDING_MODIFIERS.has(m) && mods.includes(m));
  return [...ordered, key].join("+");
}

// ---------------------------------------------------------------------------
// File import/export helpers (moved from shell)
// ---------------------------------------------------------------------------

function downloadJson(jsonStr: string): void {
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ghost-keybindings.json";
  link.click();
  URL.revokeObjectURL(url);
}

function pickJsonFile(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { reject(new Error("No file selected")); return; }
      try { resolve(await file.text()); } catch { reject(new Error("Could not read file")); }
    };
    input.click();
  });
}

// ---------------------------------------------------------------------------
// Conflict detection helper
// ---------------------------------------------------------------------------

function findConflicts(entries: KeybindingEntry[]): Set<string> {
  const keyCounts = new Map<string, number>();
  for (const entry of entries) {
    keyCounts.set(entry.key, (keyCounts.get(entry.key) ?? 0) + 1);
  }
  const conflicting = new Set<string>();
  for (const [key, count] of keyCounts) {
    if (count > 1) conflicting.add(key);
  }
  return conflicting;
}

// ---------------------------------------------------------------------------
// Main panel render
// ---------------------------------------------------------------------------

export function renderKeybindingsPanel(target: HTMLElement, service: KeybindingService): void {
  injectStyles();
  target.innerHTML = "";

  const panel = document.createElement("section");
  panel.className = "keybindings-panel";
  panel.setAttribute("aria-label", "Keybinding settings");

  const heading = document.createElement("h2");
  heading.textContent = "Keybinding Settings";
  panel.appendChild(heading);

  // Alert container
  const alertEl = document.createElement("div");
  alertEl.setAttribute("role", "alert");
  alertEl.className = "keybindings-alert";
  alertEl.style.display = "none";
  panel.appendChild(alertEl);

  function showAlert(msg: string): void {
    alertEl.textContent = msg;
    alertEl.style.display = "block";
  }
  function clearAlert(): void {
    alertEl.style.display = "none";
  }

  const rerender = () => renderKeybindingsPanel(target, service);

  // --- Overrides section ---
  const overrides = service.getOverrides();
  if (overrides.length > 0) {
    panel.appendChild(renderOverridesSection(overrides, service, rerender, showAlert, clearAlert));
  }

  // --- All bindings section ---
  const allBindings = service.getKeybindings();
  const conflictKeys = findConflicts(allBindings);
  const overrideCommands = new Set(overrides.map((o) => o.command));

  panel.appendChild(renderAllBindingsSection(allBindings, conflictKeys, overrideCommands, service, rerender, showAlert, clearAlert));

  // --- Import/Export section ---
  panel.appendChild(renderImportExportSection(service, rerender));

  // --- Reset all ---
  if (overrides.length > 0) {
    const resetBtn = document.createElement("button");
    resetBtn.className = "keybindings-btn keybindings-btn-danger";
    resetBtn.type = "button";
    resetBtn.textContent = "Reset all overrides";
    resetBtn.addEventListener("click", () => {
      service.resetAllOverrides();
      clearAlert();
      rerender();
    });
    panel.appendChild(resetBtn);
  }

  target.appendChild(panel);
}

// ---------------------------------------------------------------------------
// Overrides section
// ---------------------------------------------------------------------------

function renderOverridesSection(
  overrides: KeybindingOverride[],
  service: KeybindingService,
  rerender: () => void,
  showAlert: (msg: string) => void,
  clearAlert: () => void,
): HTMLElement {
  const section = document.createElement("div");
  section.className = "keybindings-section";

  const heading = document.createElement("h3");
  heading.textContent = "User overrides";
  section.appendChild(heading);

  const table = document.createElement("table");
  table.className = "keybindings-table";

  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Action</th><th>Chord</th><th>Actions</th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const override of overrides) {
    const tr = document.createElement("tr");

    const tdAction = document.createElement("td");
    tdAction.textContent = override.command;
    tr.appendChild(tdAction);

    const tdChord = document.createElement("td");
    const code = document.createElement("code");
    code.textContent = override.key;
    tdChord.appendChild(code);
    tr.appendChild(tdChord);

    const tdActions = document.createElement("td");
    const recordBtn = createRecordButton(override.command, service, rerender, showAlert, clearAlert);
    tdActions.appendChild(recordBtn);

    const resetBtn = document.createElement("button");
    resetBtn.className = "keybindings-btn";
    resetBtn.type = "button";
    resetBtn.textContent = "Reset";
    resetBtn.style.marginLeft = "4px";
    resetBtn.setAttribute("aria-label", `Reset keybinding for ${override.command}`);
    resetBtn.addEventListener("click", () => {
      service.removeOverride(override.command);
      clearAlert();
      rerender();
    });
    tdActions.appendChild(resetBtn);

    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  section.appendChild(table);

  return section;
}

// ---------------------------------------------------------------------------
// All bindings section
// ---------------------------------------------------------------------------

function renderAllBindingsSection(
  bindings: KeybindingEntry[],
  conflictKeys: Set<string>,
  overrideCommands: Set<string>,
  service: KeybindingService,
  rerender: () => void,
  showAlert: (msg: string) => void,
  clearAlert: () => void,
): HTMLElement {
  const section = document.createElement("div");
  section.className = "keybindings-section";

  const heading = document.createElement("h3");
  heading.textContent = "All bindings";
  section.appendChild(heading);

  if (bindings.length === 0) {
    const p = document.createElement("p");
    p.style.cssText = "margin:0;font-size:12px;color:var(--ghost-muted-foreground)";
    p.textContent = "None";
    section.appendChild(p);
    return section;
  }

  const table = document.createElement("table");
  table.className = "keybindings-table";

  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Action</th><th>Chord</th><th>Actions</th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const binding of bindings) {
    const tr = document.createElement("tr");

    const tdAction = document.createElement("td");
    tdAction.textContent = binding.command;
    tr.appendChild(tdAction);

    const tdChord = document.createElement("td");
    const code = document.createElement("code");
    code.textContent = binding.key;
    tdChord.appendChild(code);
    if (conflictKeys.has(binding.key)) {
      const badge = document.createElement("span");
      badge.className = "keybindings-badge keybindings-badge-conflict";
      badge.textContent = "conflict";
      tdChord.appendChild(badge);
    }
    tr.appendChild(tdChord);

    const tdActions = document.createElement("td");
    const alreadyOverridden = overrideCommands.has(binding.command);
    if (alreadyOverridden) {
      const span = document.createElement("span");
      span.style.cssText = "font-size:10px;color:var(--ghost-muted-foreground);margin-left:4px";
      span.textContent = "overridden";
      tdActions.appendChild(span);
    } else {
      const overrideBtn = createRecordButton(binding.command, service, rerender, showAlert, clearAlert);
      overrideBtn.textContent = "Override";
      tdActions.appendChild(overrideBtn);
    }
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  section.appendChild(table);

  return section;
}

// ---------------------------------------------------------------------------
// Record button (inline key recording)
// ---------------------------------------------------------------------------

function createRecordButton(
  command: string,
  service: KeybindingService,
  rerender: () => void,
  showAlert: (msg: string) => void,
  clearAlert: () => void,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "keybindings-btn keybindings-btn-primary";
  btn.type = "button";
  btn.textContent = "Record";
  btn.setAttribute("aria-label", `Record new keybinding for ${command}`);

  btn.addEventListener("click", () => {
    clearAlert();
    // Replace button with an input for recording
    const input = document.createElement("input");
    input.className = "keybindings-record-input";
    input.placeholder = "Press keys...";
    input.readOnly = true;
    input.setAttribute("aria-label", `Recording keybinding for ${command}`);

    const cancel = () => {
      if (input.parentElement) {
        input.parentElement.replaceChild(btn, input);
      }
    };

    input.addEventListener("blur", cancel);
    input.addEventListener("keydown", (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const chord = normalizeKeyboardEventChord(event);
      if (!chord) return;

      if (!isBrowserSafe(chord)) {
        showAlert(`"${chord}" is reserved by the browser and cannot be bound.`);
        cancel();
        return;
      }

      service.addOverride(command, chord);
      clearAlert();
      rerender();
    });

    btn.parentElement!.replaceChild(input, btn);
    input.focus();
  });

  return btn;
}

// ---------------------------------------------------------------------------
// Import/Export section
// ---------------------------------------------------------------------------

function renderImportExportSection(service: KeybindingService, rerender: () => void): HTMLElement {
  const section = document.createElement("div");
  section.className = "keybindings-section";

  const heading = document.createElement("h3");
  heading.textContent = "Import / Export";
  section.appendChild(heading);

  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:8px";

  const exportBtn = document.createElement("button");
  exportBtn.className = "keybindings-btn";
  exportBtn.type = "button";
  exportBtn.textContent = "Export JSON";
  exportBtn.setAttribute("aria-label", "Export keybinding overrides as JSON");
  exportBtn.addEventListener("click", () => {
    const jsonStr = service.exportOverrides();
    downloadJson(jsonStr);
  });
  row.appendChild(exportBtn);

  const importBtn = document.createElement("button");
  importBtn.className = "keybindings-btn";
  importBtn.type = "button";
  importBtn.textContent = "Import JSON";
  importBtn.setAttribute("aria-label", "Import keybinding overrides from JSON file");

  const statusEl = document.createElement("div");
  statusEl.className = "keybindings-import-status";
  statusEl.style.display = "none";

  importBtn.addEventListener("click", async () => {
    try {
      const text = await pickJsonFile();
      const result = service.importOverrides(text);
      statusEl.style.display = "block";
      if (result.errors.length > 0) {
        statusEl.textContent = `Import errors: ${result.errors.join("; ")}`;
      } else {
        statusEl.textContent = `Imported ${result.imported} override(s)`;
      }
      rerender();
    } catch {
      statusEl.style.display = "block";
      statusEl.textContent = "Import cancelled or file unreadable.";
    }
  });
  row.appendChild(importBtn);

  section.appendChild(row);
  section.appendChild(statusEl);

  return section;
}
