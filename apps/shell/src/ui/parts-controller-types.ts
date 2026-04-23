import type { BridgeHost } from "../app/types.js";
import type { ShellPartHostAdapter } from "../app/contracts.js";
import type { SelectionSyncEvent } from "../window-bridge.js";

export type PartsControllerDeps = {
  applySelection: (event: SelectionSyncEvent) => void;
  partHost: ShellPartHostAdapter;
  publishWithDegrade: (event: Parameters<BridgeHost["bridge"]["publish"]>[0]) => void;
  renderContextControls: () => void;
  renderParts: () => void;
  renderSyncStatus: () => void;
};
