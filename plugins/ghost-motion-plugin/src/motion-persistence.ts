import type { GhostMotionConfig } from "./config-types.js";

const STORAGE_KEY = "ghost-shell-motion-preference";

export function loadMotionPreference(): GhostMotionConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).enabled === "boolean"
    ) {
      return parsed as GhostMotionConfig;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveMotionPreference(config: GhostMotionConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function clearMotionPreference(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently ignore
  }
}
