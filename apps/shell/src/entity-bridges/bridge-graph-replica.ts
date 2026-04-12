import type { BridgeActivationEvent } from "../window-bridge.js";

export interface RemoteBridgeEntry {
  bridgeId: string;
  sourceEntityType: string;
  targetEntityType: string;
  ownerWindowId: string;
}

export interface BridgeGraphReplica {
  /** Apply an activation event from a remote window */
  applyActivation(event: BridgeActivationEvent): void;
  /** Get all remote bridges (across all remote windows) */
  getRemoteBridges(): RemoteBridgeEntry[];
  /** Get a remote bridge entry by bridgeId (first match) */
  findRemoteBridge(bridgeId: string): RemoteBridgeEntry | null;
  /** Find which window owns an activated bridge */
  findOwnerWindow(bridgeId: string): string | null;
  /** Remove all entries for a window (e.g., window closed) */
  removeWindow(windowId: string): void;
  /** Clear all state */
  dispose(): void;
}

function makeKey(bridgeId: string, ownerWindowId: string): string {
  return `${bridgeId}:${ownerWindowId}`;
}

export function createBridgeGraphReplica(): BridgeGraphReplica {
  const entries = new Map<string, RemoteBridgeEntry>();

  return {
    applyActivation(event: BridgeActivationEvent): void {
      const key = makeKey(event.bridgeId, event.sourceWindowId);

      if (event.action === "activated") {
        entries.set(key, {
          bridgeId: event.bridgeId,
          sourceEntityType: event.sourceEntityType,
          targetEntityType: event.targetEntityType,
          ownerWindowId: event.sourceWindowId,
        });
      } else {
        entries.delete(key);
      }
    },

    getRemoteBridges(): RemoteBridgeEntry[] {
      return Array.from(entries.values());
    },

    findRemoteBridge(bridgeId: string): RemoteBridgeEntry | null {
      for (const entry of entries.values()) {
        if (entry.bridgeId === bridgeId) {
          return entry;
        }
      }
      return null;
    },

    findOwnerWindow(bridgeId: string): string | null {
      for (const entry of entries.values()) {
        if (entry.bridgeId === bridgeId) {
          return entry.ownerWindowId;
        }
      }
      return null;
    },

    removeWindow(windowId: string): void {
      for (const [key, entry] of entries) {
        if (entry.ownerWindowId === windowId) {
          entries.delete(key);
        }
      }
    },

    dispose(): void {
      entries.clear();
    },
  };
}
