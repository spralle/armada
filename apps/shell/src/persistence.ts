import { createDefaultLayoutState, type ShellLayoutState } from "./layout.js";

export interface ShellLayoutPersistence {
  load(): ShellLayoutState;
  save(state: ShellLayoutState): void;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const LAYOUT_STORAGE_KEY = "armada.shell.layout.v1";

export function createLocalStorageLayoutPersistence(
  storage: StorageLike | undefined,
): ShellLayoutPersistence {
  return {
    load() {
      if (!storage) {
        return createDefaultLayoutState();
      }

      const raw = storage.getItem(LAYOUT_STORAGE_KEY);
      if (!raw) {
        return createDefaultLayoutState();
      }

      const parsed = safeParse(raw);
      if (!parsed) {
        return createDefaultLayoutState();
      }

      const fallback = createDefaultLayoutState();
      return {
        sideSize:
          typeof parsed.sideSize === "number" ? parsed.sideSize : fallback.sideSize,
        secondarySize:
          typeof parsed.secondarySize === "number"
            ? parsed.secondarySize
            : fallback.secondarySize,
      };
    },
    save(state) {
      if (!storage) {
        return;
      }
      storage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state));
    },
  };
}

function safeParse(input: string): Partial<ShellLayoutState> | null {
  try {
    return JSON.parse(input) as Partial<ShellLayoutState>;
  } catch {
    return null;
  }
}
