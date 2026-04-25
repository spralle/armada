import type { KeybindingOverrideEntry } from "./keybinding-persistence-contracts.js";
import { normalizeConfiguredSequence } from "./keybinding-normalizer.js";

// ---------------------------------------------------------------------------
// Export envelope
// ---------------------------------------------------------------------------

export interface KeybindingExportEnvelope {
  version: 1;
  exportedAt: string;
  overrides: KeybindingOverrideEntry[];
}

// ---------------------------------------------------------------------------
// Import result
// ---------------------------------------------------------------------------

export interface KeybindingImportResult {
  success: boolean;
  entries: KeybindingOverrideEntry[];
  warnings: string[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function exportKeybindingOverrides(
  overrides: KeybindingOverrideEntry[],
): KeybindingExportEnvelope {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    overrides: overrides.map((entry) => ({
      action: entry.action,
      keybinding: entry.keybinding,
    })),
  };
}

// ---------------------------------------------------------------------------
// Import validation
// ---------------------------------------------------------------------------

export function validateKeybindingImport(
  input: unknown,
  knownActions: ReadonlySet<string>,
): KeybindingImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const entries: KeybindingOverrideEntry[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    errors.push("Input must be a JSON object with version and overrides fields.");
    return { success: false, entries, warnings, errors };
  }

  const record = input as Record<string, unknown>;

  if (record.version !== 1) {
    errors.push(
      `Unsupported version: ${String(record.version)}. Only version 1 is supported.`,
    );
    return { success: false, entries, warnings, errors };
  }

  if (!Array.isArray(record.overrides)) {
    errors.push("Missing or invalid 'overrides' array.");
    return { success: false, entries, warnings, errors };
  }

  const overrides = record.overrides as unknown[];

  for (let i = 0; i < overrides.length; i++) {
    const item = overrides[i];

    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      warnings.push(`Entry ${i}: skipped — not an object.`);
      continue;
    }

    const entry = item as Record<string, unknown>;

    if (typeof entry.action !== "string" || entry.action.trim().length === 0) {
      warnings.push(`Entry ${i}: skipped — missing or empty 'action'.`);
      continue;
    }

    if (typeof entry.keybinding !== "string" || entry.keybinding.trim().length === 0) {
      warnings.push(`Entry ${i}: skipped — missing or empty 'keybinding'.`);
      continue;
    }

    const normalized = normalizeConfiguredSequence(entry.keybinding);
    if (!normalized) {
      warnings.push(
        `Entry ${i}: skipped — invalid keybinding "${entry.keybinding}".`,
      );
      continue;
    }

    if (!knownActions.has(entry.action)) {
      warnings.push(
        `Entry ${i}: action "${entry.action}" is not recognised (may be from another version).`,
      );
    }

    entries.push({ action: entry.action, keybinding: normalized.value });
  }

  if (entries.length === 0 && overrides.length > 0) {
    errors.push("No valid entries found in import data.");
    return { success: false, entries, warnings, errors };
  }

  return { success: true, entries, warnings, errors };
}

// ---------------------------------------------------------------------------
// DOM helpers (download / file picker)
// ---------------------------------------------------------------------------

export function downloadKeybindingExport(envelope: KeybindingExportEnvelope): void {
  const json = JSON.stringify(envelope, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ghost-keybindings.json";
  link.click();
  URL.revokeObjectURL(url);
}

export function readKeybindingImportFile(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }
      try {
        const text = await file.text();
        const parsed: unknown = JSON.parse(text);
        resolve(parsed);
      } catch {
        reject(new Error("Could not read file as JSON"));
      }
    };
    input.click();
  });
}
