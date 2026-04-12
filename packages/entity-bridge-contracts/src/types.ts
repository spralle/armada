// Bridge contribution (declared in plugin contracts)
export interface PluginEntityBridgeContribution {
  id: string;
  sourceEntityType: string;
  targetEntityType: string;
  capabilities?: EntityBridgeCapabilities | undefined;
}

export interface EntityBridgeCapabilities {
  projections?: string[] | undefined;
  pageable?: boolean | undefined;
  filterable?: boolean | undefined;
  sortable?: boolean | undefined;
}

// Bridge query (consumer -> broker)
export interface BridgeQuery {
  sourceIds: string[];
  projection?: string | undefined;
  page?: BridgePage | undefined;
  sort?: BridgeSortEntry[] | undefined;
  filter?: Record<string, unknown> | undefined;
}

export interface BridgePage {
  offset: number;
  limit: number;
}

export interface BridgeSortEntry {
  field: string;
  direction: "asc" | "desc";
}

// Bridge result (broker -> consumer)
export interface BridgeResult<T = unknown> {
  ids: string[];
  data?: T[] | undefined;
  totalCount: number;
  page?: BridgePage | undefined;
}

// Graph discovery types
export interface EntityReachabilityEdge {
  sourceEntityType: string;
  targetEntityType: string;
  bridgeId: string;
  depth: number;
  isCyclic: boolean;
}

export interface EntityReachabilityMap {
  sourceEntityType: string;
  edges: EntityReachabilityEdge[];
}

// Bridge handler (producer-side, for runtime activation)
export interface EntityBridgeHandler {
  resolve(query: BridgeQuery): Promise<BridgeResult>;
}
