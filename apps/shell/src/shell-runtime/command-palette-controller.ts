import type { ActionSurfaceContext } from "../action-surface.js";
import {
  buildCommandPaletteCatalog,
  type CommandPaletteCatalogOptions,
} from "./command-palette-catalog.js";
import {
  createInitialPaletteState,
  reducePaletteState,
  type CommandPaletteAction,
  type CommandPaletteState,
} from "./command-palette-state.js";

export interface CommandPaletteController {
  isOpen(): boolean;
  toggle(catalog: CommandPaletteCatalogOptions): void;
  close(): void;
  getState(): CommandPaletteState;
  dispatch(action: CommandPaletteAction): void;
}

export function createCommandPaletteController(): CommandPaletteController {
  let state = createInitialPaletteState();

  return {
    isOpen() {
      return state.phase === "open";
    },

    toggle(catalog) {
      if (state.phase === "open") {
        state = reducePaletteState(state, { type: "close" });
      } else {
        const entries = buildCommandPaletteCatalog(catalog);
        state = reducePaletteState(state, { type: "open", entries });
      }
    },

    close() {
      state = reducePaletteState(state, { type: "close" });
    },

    getState() {
      return state;
    },

    dispatch(action) {
      state = reducePaletteState(state, action);
    },
  };
}
