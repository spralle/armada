// Override status and audit query endpoints

import type { Route } from "./router.js";
import { jsonResponse } from "./router.js";
import { validateTenantId } from "./config-loader.js";
import type { ConfigAuditLog } from "@ghost/config-server";
import type { OverrideTracker } from "@ghost/config-server";

export interface OverrideRouteOptions {
  auditLog: ConfigAuditLog;
  overrideTracker: OverrideTracker;
}

export function createOverrideRoutes(options: OverrideRouteOptions): Route[] {
  const { auditLog, overrideTracker } = options;

  return [
    // GET /api/tenants/{tenantId}/overrides — list active emergency overrides
    {
      method: "GET",
      pattern: /^\/api\/tenants\/([^/]+)\/overrides$/,
      handler: async (params) => {
        const tenantId = params[0];
        if (!validateTenantId(tenantId)) {
          return jsonResponse({ error: "invalid_tenant_id" }, 400);
        }

        const active = await overrideTracker.listActive();
        const filtered = active.filter((r) => r.tenantId === tenantId);
        return jsonResponse(filtered);
      },
    },

    // GET /api/tenants/{tenantId}/overrides/overdue — list overdue overrides
    {
      method: "GET",
      pattern: /^\/api\/tenants\/([^/]+)\/overrides\/overdue$/,
      handler: async (params) => {
        const tenantId = params[0];
        if (!validateTenantId(tenantId)) {
          return jsonResponse({ error: "invalid_tenant_id" }, 400);
        }

        const overdue = await overrideTracker.listOverdue();
        const filtered = overdue.filter((r) => r.tenantId === tenantId);
        return jsonResponse(filtered);
      },
    },

    // POST /api/tenants/{tenantId}/overrides/{id}/regularize — mark override as regularized
    {
      method: "POST",
      pattern: /^\/api\/tenants\/([^/]+)\/overrides\/([^/]+)\/regularize$/,
      handler: async (params, request) => {
        const tenantId = params[0];
        const overrideId = params[1];
        if (!validateTenantId(tenantId)) {
          return jsonResponse({ error: "invalid_tenant_id" }, 400);
        }

        const body = (await request.body()) as { regularizedBy?: string } | null;
        if (body === null || typeof body !== "object" || typeof body.regularizedBy !== "string") {
          return jsonResponse(
            { error: "invalid_body", message: "Body must contain { regularizedBy: string }" },
            400,
          );
        }

        const result = await overrideTracker.regularize(overrideId, body.regularizedBy);
        if (result === undefined) {
          return jsonResponse({ error: "not_found", id: overrideId }, 404);
        }

        return jsonResponse(result);
      },
    },

    // GET /api/tenants/{tenantId}/audit — query audit log entries
    {
      method: "GET",
      pattern: /^\/api\/tenants\/([^/]+)\/audit$/,
      handler: async (params, request) => {
        const tenantId = params[0];
        if (!validateTenantId(tenantId)) {
          return jsonResponse({ error: "invalid_tenant_id" }, 400);
        }

        // Parse query params from search string
        const searchParams = new URLSearchParams(request.search ?? "");
        const key = searchParams.get("key") ?? undefined;
        const from = searchParams.get("from") ?? undefined;
        const to = searchParams.get("to") ?? undefined;
        const limitStr = searchParams.get("limit");
        const limit = limitStr !== null ? parseInt(limitStr, 10) : undefined;

        let entries;
        if (key !== undefined) {
          entries = await auditLog.queryByKey(key);
        } else if (from !== undefined && to !== undefined) {
          entries = await auditLog.queryByTimeRange(from, to);
        } else {
          entries = await auditLog.getRecent(limit);
        }

        // Filter to tenant
        const filtered = entries.filter((e) => e.tenantId === tenantId);
        return jsonResponse(filtered);
      },
    },
  ];
}
