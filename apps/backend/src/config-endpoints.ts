import type { Route } from "./router.js";
import { jsonResponse } from "./router.js";
import { createTenantConfigProviders, validateTenantId } from "./config-loader.js";
import type { ConfigLoaderOptions } from "./config-loader.js";
import { resolveConfiguration, inspectKey } from "@ghost/config-engine";
import type { ConfigurationLayerEntry } from "@ghost/config-types";

async function loadLayerStack(
  options: ConfigLoaderOptions,
  tenantId: string,
): Promise<ConfigurationLayerEntry[]> {
  const providers = createTenantConfigProviders(options, tenantId);
  const [coreData, appData, tenantData] = await Promise.all([
    providers.core.load(),
    providers.app.load(),
    providers.tenant.load(),
  ]);

  return [
    { layer: "core", entries: coreData.entries },
    { layer: "app", entries: appData.entries },
    { layer: "tenant", entries: tenantData.entries },
  ];
}

export function createConfigRoutes(loaderOptions: ConfigLoaderOptions): Route[] {
  return [
    // GET /api/tenants/{tenantId}/config — resolved merged config
    {
      method: "GET",
      pattern: /^\/api\/tenants\/([^/]+)\/config$/,
      handler: async (params) => {
        const tenantId = params[0];
        if (!validateTenantId(tenantId)) {
          return jsonResponse({ error: "invalid_tenant_id" }, 400);
        }

        const layers = await loadLayerStack(loaderOptions, tenantId);
        const resolved = resolveConfiguration({ layers });
        return jsonResponse(resolved.entries);
      },
    },

    // GET /api/tenants/{tenantId}/config-layers — per-layer breakdown
    // NOTE: This must be listed BEFORE the /config/(.+) route
    // to avoid the (.+) pattern matching "layers" after a hyphen collision.
    // Actually the patterns are distinct: /config$ vs /config-layers$ vs /config/(.+)$
    // but we order defensively.
    {
      method: "GET",
      pattern: /^\/api\/tenants\/([^/]+)\/config-layers$/,
      handler: async (params) => {
        const tenantId = params[0];
        if (!validateTenantId(tenantId)) {
          return jsonResponse({ error: "invalid_tenant_id" }, 400);
        }

        const providers = createTenantConfigProviders(loaderOptions, tenantId);
        const [coreData, appData, tenantData] = await Promise.all([
          providers.core.load(),
          providers.app.load(),
          providers.tenant.load(),
        ]);

        return jsonResponse({
          core: coreData.entries,
          app: appData.entries,
          tenant: tenantData.entries,
        });
      },
    },

    // GET /api/tenants/{tenantId}/config/{key+} — single key with inspection
    {
      method: "GET",
      pattern: /^\/api\/tenants\/([^/]+)\/config\/(.+)$/,
      handler: async (params) => {
        const tenantId = params[0];
        const key = params[1];
        if (!validateTenantId(tenantId)) {
          return jsonResponse({ error: "invalid_tenant_id" }, 400);
        }

        const layers = await loadLayerStack(loaderOptions, tenantId);
        const inspection = inspectKey({ layers }, key);

        if (inspection.effectiveValue === undefined) {
          return jsonResponse({ error: "not_found", key }, 404);
        }

        return jsonResponse({
          key,
          value: inspection.effectiveValue,
          inspection,
        });
      },
    },

    // PUT /api/tenants/{tenantId}/config/{key+} — set value at tenant layer
    {
      method: "PUT",
      pattern: /^\/api\/tenants\/([^/]+)\/config\/(.+)$/,
      handler: async (params, request) => {
        const tenantId = params[0];
        const key = params[1];
        if (!validateTenantId(tenantId)) {
          return jsonResponse({ error: "invalid_tenant_id" }, 400);
        }

        const body = (await request.body()) as { value?: unknown } | null;
        if (body === null || typeof body !== "object" || !("value" in body)) {
          return jsonResponse({ error: "invalid_body", message: "Body must contain { value: ... }" }, 400);
        }

        const providers = createTenantConfigProviders(loaderOptions, tenantId);
        const result = await providers.tenant.write(key, body.value);

        if (!result.success) {
          return jsonResponse({ error: "write_failed", message: result.error }, 500);
        }

        return jsonResponse({ success: true, key, revision: result.revision });
      },
    },

    // DELETE /api/tenants/{tenantId}/config/{key+} — remove from tenant layer
    {
      method: "DELETE",
      pattern: /^\/api\/tenants\/([^/]+)\/config\/(.+)$/,
      handler: async (params) => {
        const tenantId = params[0];
        const key = params[1];
        if (!validateTenantId(tenantId)) {
          return jsonResponse({ error: "invalid_tenant_id" }, 400);
        }

        const providers = createTenantConfigProviders(loaderOptions, tenantId);
        const result = await providers.tenant.remove(key);

        if (!result.success) {
          return jsonResponse({ error: "remove_failed", message: result.error }, 500);
        }

        return jsonResponse({ success: true, key, revision: result.revision });
      },
    },
  ];
}
