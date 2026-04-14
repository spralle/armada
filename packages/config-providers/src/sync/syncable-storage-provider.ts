import type { ConfigurationLayer } from "@ghost/config-types";
import {
  createSyncableStorageProviderAdapter,
  type SyncableStorageProviderAdapter,
  type SyncableStorageProviderAdapterOptions,
} from "@ghost/config-sync";

export interface CreateSyncableStorageProviderOptions
  extends Omit<SyncableStorageProviderAdapterOptions, "id" | "layer"> {
  id: string;
  layer: ConfigurationLayer | string;
}

export function createSyncableStorageProvider(
  options: CreateSyncableStorageProviderOptions,
): SyncableStorageProviderAdapter {
  return createSyncableStorageProviderAdapter({
    ...options,
    id: options.id,
    layer: options.layer,
  });
}
