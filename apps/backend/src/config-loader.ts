import { FileSystemStorageProvider } from "@ghost/config-server";
import { resolve } from "node:path";

export interface ConfigLoaderOptions {
  configDir: string;
  environment?: string | undefined;
}

export interface TenantConfigProviders {
  core: FileSystemStorageProvider;
  app: FileSystemStorageProvider;
  tenant: FileSystemStorageProvider;
}

/**
 * Validates a tenant ID to prevent directory traversal.
 * Only lowercase alphanumeric and hyphens, must start with alphanumeric.
 */
export function validateTenantId(tenantId: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(tenantId);
}

/**
 * Creates FileSystemStorageProvider instances for a tenant's config layers.
 * Core and app are read-only; tenant is writable.
 * Caller MUST validate tenantId before calling this function.
 */
export function createTenantConfigProviders(
  options: ConfigLoaderOptions,
  tenantId: string,
): TenantConfigProviders {
  const configDir = resolve(options.configDir);

  const environmentOverlayPath = options.environment
    ? resolve(configDir, `app.${options.environment}.json`)
    : undefined;

  const core = new FileSystemStorageProvider({
    id: "core",
    layer: "core",
    filePath: resolve(configDir, "core.json"),
    writable: false,
  });

  const appOptions: ConstructorParameters<typeof FileSystemStorageProvider>[0] = {
    id: "app",
    layer: "app",
    filePath: resolve(configDir, "app.json"),
    writable: false,
  };
  if (environmentOverlayPath !== undefined) {
    appOptions.environmentOverlayPath = environmentOverlayPath;
  }
  const app = new FileSystemStorageProvider(appOptions);

  const tenant = new FileSystemStorageProvider({
    id: `tenant-${tenantId}`,
    layer: "tenant",
    filePath: resolve(configDir, "tenants", tenantId, "tenant.json"),
    writable: true,
  });

  return { core, app, tenant };
}
