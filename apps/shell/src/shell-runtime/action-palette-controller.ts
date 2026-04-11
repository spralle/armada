import type { ActionSurfaceContext } from "../action-surface.js";
import {
  buildActionPaletteCatalog,
  type ActionPaletteCatalogOptions,
} from "./action-palette-catalog.js";
import {
  createInitialPaletteState,
  reducePaletteState,
  type ActionPaletteAction,
  type ActionPaletteState,
} from "./action-palette-state.js";

export interface ActionPaletteController {
  isOpen(): boolean;
  toggle(catalog: ActionPaletteCatalogOptions): void;
  close(): void;
  getState(): ActionPaletteState;
  dispatch(action: ActionPaletteAction): void;
}

export function createActionPaletteController(): ActionPaletteController {
  let state = createInitialPaletteState();

  return {
    isOpen() {
      return state.phase === "open";
    },

    toggle(catalog) {
      if (state.phase === "open") {
        state = reducePaletteState(state, { type: "close" });
      } else {
        const entries = buildActionPaletteCatalog(catalog);
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
