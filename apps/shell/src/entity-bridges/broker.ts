import type {
  BridgeQuery,
  BridgeResult,
  EntityBridgeHandler,
  EntityReachabilityMap,
  PluginEntityBridgeContribution,
} from "@ghost/entity-bridge-contracts";
import { discoverReachable } from "@ghost/entity-bridge-contracts";
import type {
  ActiveBridge,
  BridgeInvalidationEvent,
  BridgeInvalidationListener,
  EntityBridgeBroker,
} from "./broker-types.js";

interface StoredDeclaration {
  pluginId: string;
  contribution: PluginEntityBridgeContribution;
}

export function createEntityBridgeBroker(): EntityBridgeBroker {
  const declarations = new Map<string, StoredDeclaration>();
  const handlers = new Map<string, EntityBridgeHandler>();
  const listeners = new Set<BridgeInvalidationListener>();

  function fireInvalidation(event: BridgeInvalidationEvent): void {
    for (const listener of listeners) {
      listener(event);
    }
  }

  const broker: EntityBridgeBroker = {
    loadDeclarations(
      incoming: ReadonlyArray<PluginEntityBridgeContribution & { pluginId: string }>,
    ): void {
      for (const decl of incoming) {
        declarations.set(decl.id, {
          pluginId: decl.pluginId,
          contribution: {
            id: decl.id,
            sourceEntityType: decl.sourceEntityType,
            targetEntityType: decl.targetEntityType,
            capabilities: decl.capabilities,
          },
        });
      }
    },

    activate(bridgeId: string, handler: EntityBridgeHandler): void {
      if (!declarations.has(bridgeId)) {
        throw new Error(`Cannot activate unknown bridge: ${bridgeId}`);
      }
      handlers.set(bridgeId, handler);
    },

    deactivate(bridgeId: string): void {
      handlers.delete(bridgeId);
      fireInvalidation({ bridgeId, reason: "provider-deactivated" });
    },

    async resolve(bridgeId: string, query: BridgeQuery): Promise<BridgeResult> {
      const handler = handlers.get(bridgeId);
      if (!handler) {
        throw new Error(
          `Cannot resolve bridge "${bridgeId}": not activated`,
        );
      }
      return handler.resolve(query);
    },

    discoverReachable(sourceEntityType: string): EntityReachabilityMap {
      const contributions = Array.from(declarations.values()).map(
        (d) => d.contribution,
      );
      return discoverReachable(contributions, sourceEntityType);
    },

    getActiveBridges(): ActiveBridge[] {
      const result: ActiveBridge[] = [];
      for (const [bridgeId, stored] of declarations) {
        result.push({
          bridgeId,
          pluginId: stored.pluginId,
          sourceEntityType: stored.contribution.sourceEntityType,
          targetEntityType: stored.contribution.targetEntityType,
          status: handlers.has(bridgeId) ? "activated" : "declared",
        });
      }
      return result;
    },

    onInvalidation(listener: BridgeInvalidationListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    invalidate(
      bridgeId: string,
      reason: BridgeInvalidationEvent["reason"],
    ): void {
      fireInvalidation({ bridgeId, reason });
    },

    dispose(): void {
      declarations.clear();
      handlers.clear();
      listeners.clear();
    },
  };

  return broker;
}
