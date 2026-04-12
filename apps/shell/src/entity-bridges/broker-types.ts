import type {
  BridgeQuery,
  BridgeResult,
  EntityBridgeHandler,
  EntityReachabilityMap,
  PluginEntityBridgeContribution,
} from "@ghost/entity-bridge-contracts";

export interface ActiveBridge {
  bridgeId: string;
  pluginId: string;
  sourceEntityType: string;
  targetEntityType: string;
  status: "declared" | "activated";
}

export interface BridgeActivation {
  bridgeId: string;
  handler: EntityBridgeHandler;
}

export interface BridgeInvalidationListener {
  (event: BridgeInvalidationEvent): void;
}

export interface BridgeInvalidationEvent {
  bridgeId: string;
  reason: "selection-changed" | "provider-deactivated" | "data-updated";
}

export interface EntityBridgeBroker {
  loadDeclarations(
    declarations: ReadonlyArray<PluginEntityBridgeContribution & { pluginId: string }>,
  ): void;
  activate(bridgeId: string, handler: EntityBridgeHandler): void;
  deactivate(bridgeId: string): void;
  resolve(bridgeId: string, query: BridgeQuery): Promise<BridgeResult>;
  discoverReachable(sourceEntityType: string): EntityReachabilityMap;
  getActiveBridges(): ActiveBridge[];
  onInvalidation(listener: BridgeInvalidationListener): () => void;
  invalidate(bridgeId: string, reason: BridgeInvalidationEvent["reason"]): void;
  dispose(): void;
}
