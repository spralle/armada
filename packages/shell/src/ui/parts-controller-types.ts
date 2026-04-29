import type { SelectionSyncEvent } from "@ghost-shell/bridge";
import type { ShellPartHostAdapter } from "../app/contracts.js";
import type { BridgeHost } from "../app/types.js";

export type PartsControllerDeps = {
  applySelection: (event: SelectionSyncEvent) => void;
  partHost: ShellPartHostAdapter;
  publishWithDegrade: (event: Parameters<BridgeHost["bridge"]["publish"]>[0]) => void;
  renderContextControls: () => void;
  renderParts: () => void;
  renderSyncStatus: () => void;
};
