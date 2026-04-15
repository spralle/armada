import type { Route } from "./router.js";
import { jsonResponse } from "./router.js";
import { createTenantConfigProviders, validateTenantId } from "./config-loader.js";
import type { ConfigLoaderOptions } from "./config-loader.js";
import { resolveConfiguration, inspectKey } from "@weaver/config-engine";
import type { ConfigurationLayerEntry, ConfigurationPropertySchema } from "@weaver/config-types";
import type { ConfigAuditLog, OverrideTracker } from "@weaver/config-server";
import {
  extractAccessContext,
  checkPolicy,
  policyToResponse,
  recordAudit,
  recordOverride,
  type PolicyCheckDeps,
} from "./config-auth.js";

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

export interface ConfigRouteOptions {
  schemaMap?: Map<string, ConfigurationPropertySchema> | undefined;
  auditLog?: ConfigAuditLog | undefined;
  overrideTracker?: OverrideTracker | undefined;
}

export function createConfigRoutes(
  loaderOptions: ConfigLoaderOptions,
  options?: ConfigRouteOptions | undefined,
): Route[] {
  const deps: PolicyCheckDeps = {
    schemaMap: options?.schemaMap,
    auditLog: options?.auditLog,
    overrideTracker: options?.overrideTracker,
  };
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

        // Policy enforcement
        const context = extractAccessContext(request.headers);
        const { decision, schema } = checkPolicy(key, deps, context, "tenant");
        const rejection = policyToResponse(decision);
        if (rejection !== undefined) {
          return rejection;
        }

        const providers = createTenantConfigProviders(loaderOptions, tenantId);
        const result = await providers.tenant.write(key, body.value);

        if (!result.success) {
          return jsonResponse({ error: "write_failed", message: result.error }, 500);
        }

        // Audit logging
        const isEmergency = context.sessionMode === "emergency-override"
          && schema?.changePolicy === "emergency-override";
        await recordAudit(deps, {
          timestamp: new Date().toISOString(),
          actor: context.userId,
          action: "set",
          key,
          layer: "tenant",
          tenantId,
          newValue: body.value,
          changePolicy: schema?.changePolicy,
          isEmergencyOverride: isEmergency,
          overrideReason: isEmergency ? context.overrideReason : undefined,
        });

        // Emergency override tracking
        if (isEmergency && context.overrideReason !== undefined) {
          await recordOverride(deps, {
            key,
            actor: context.userId,
            reason: context.overrideReason,
            tenantId,
            layer: "tenant",
          });
        }

        return jsonResponse({ success: true, key, revision: result.revision });
      },
    },

    // DELETE /api/tenants/{tenantId}/config/{key+} — remove from tenant layer
    {
      method: "DELETE",
      pattern: /^\/api\/tenants\/([^/]+)\/config\/(.+)$/,
      handler: async (params, request) => {
        const tenantId = params[0];
        const key = params[1];
        if (!validateTenantId(tenantId)) {
          return jsonResponse({ error: "invalid_tenant_id" }, 400);
        }

        // Policy enforcement
        const context = extractAccessContext(request.headers);
        const { decision, schema } = checkPolicy(key, deps, context, "tenant");
        const rejection = policyToResponse(decision);
        if (rejection !== undefined) {
          return rejection;
        }

        const providers = createTenantConfigProviders(loaderOptions, tenantId);
        const result = await providers.tenant.remove(key);

        if (!result.success) {
          return jsonResponse({ error: "remove_failed", message: result.error }, 500);
        }

        // Audit logging
        const isEmergency = context.sessionMode === "emergency-override"
          && schema?.changePolicy === "emergency-override";
        await recordAudit(deps, {
          timestamp: new Date().toISOString(),
          actor: context.userId,
          action: "remove",
          key,
          layer: "tenant",
          tenantId,
          changePolicy: schema?.changePolicy,
          isEmergencyOverride: isEmergency,
          overrideReason: isEmergency ? context.overrideReason : undefined,
        });

        return jsonResponse({ success: true, key, revision: result.revision });
      },
    },
  ];
}
