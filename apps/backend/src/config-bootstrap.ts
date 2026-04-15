// Backend config bootstrap — creates a ConfigurationService at startup

import { FileSystemStorageProvider } from "@ghost/config-server";
import { createServiceConfigurationService } from "@ghost/config-server";
import { createConfigurationService } from "@ghost/config-providers";
import type {
  ConfigurationService,
  ServiceConfigurationService,
  ConfigurationPropertySchema,
} from "@ghost/config-types";
import { resolve } from "node:path";

export interface BackendConfigBootstrapOptions {
  configDir: string;
  environment?: string | undefined;
  tenantId?: string | undefined;
}

export interface BackendConfigResult {
  configService: ConfigurationService;
  serviceConfig: ServiceConfigurationService;
}

const backendSchemaMap = new Map<string, ConfigurationPropertySchema>([
  ["port", { type: "number", default: 8787, description: "Backend server port", reloadBehavior: "restart-required" }],
  ["corsOrigin", { type: "string", default: "*", description: "CORS allowed origin", reloadBehavior: "hot" }],
]);

export async function bootstrapBackendConfig(
  options: BackendConfigBootstrapOptions,
): Promise<BackendConfigResult> {
  const { configDir, environment, tenantId = "demo" } = options;

  const coreProvider = new FileSystemStorageProvider({
    id: "core-fs",
    layer: "core",
    filePath: resolve(configDir, "core.json"),
  });

  const appProviderOptions: ConstructorParameters<typeof FileSystemStorageProvider>[0] = {
    id: "app-fs",
    layer: "app",
    filePath: resolve(configDir, "app.json"),
  };
  if (environment !== undefined) {
    appProviderOptions.environmentOverlayPath = resolve(configDir, `app.${environment}.json`);
  }
  const appProvider = new FileSystemStorageProvider(appProviderOptions);

  const tenantProvider = new FileSystemStorageProvider({
    id: "tenant-fs",
    layer: "tenant",
    filePath: resolve(configDir, "tenants", tenantId, "tenant.json"),
    writable: true,
  });

  const configService = await createConfigurationService({
    providers: [coreProvider, appProvider, tenantProvider],
  });

  const serviceConfig = createServiceConfigurationService({
    configService,
    namespace: "ghost.backend",
    schemaMap: backendSchemaMap,
  });

  return { configService, serviceConfig };
}

export function logConfigBootstrapSummary(
  configDir: string,
  environment: string | undefined,
  tenantId: string,
): void {
  console.log("[backend:config] bootstrap", {
    configDir,
    environment: environment ?? "none",
    tenantId,
  });
}
