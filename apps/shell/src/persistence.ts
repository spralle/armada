import {
  createDefaultLayoutState,
  sanitizeLayoutState,
  type PartialLayoutState,
  type ShellLayoutState,
} from "./layout.js";

export interface ShellLayoutPersistence {
  load(): ShellLayoutState;
  save(state: ShellLayoutState): void;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const LAYOUT_STORAGE_KEY = "armada.shell.layout.v1";

interface LayoutPersistenceOptions {
  userId: string;
}

export function createLocalStorageLayoutPersistence(
  storage: StorageLike | undefined,
  options: LayoutPersistenceOptions,
): ShellLayoutPersistence {
  const storageKey = `${LAYOUT_STORAGE_KEY}.${options.userId}`;

  return {
    load() {
      if (!storage) {
        return createDefaultLayoutState();
      }

      const raw = storage.getItem(storageKey);
      if (!raw) {
        return createDefaultLayoutState();
      }

      const parsed = safeParse(raw);
      if (!parsed) {
        return createDefaultLayoutState();
      }

      return sanitizeLayoutState(parsed);
    },
    save(state) {
      if (!storage) {
        return;
      }

      const safeState = sanitizeLayoutState(state);
      storage.setItem(storageKey, JSON.stringify(safeState));
    },
  };
}

function safeParse(input: string): PartialLayoutState | null {
  try {
    return JSON.parse(input) as Partial<ShellLayoutState>;
  } catch {
    return null;
  }
}
