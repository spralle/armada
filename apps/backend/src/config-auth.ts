// Auth context extraction from request headers

import type { ConfigurationRole } from "@weaver/config-types";
import type { PolicyEvaluationContext, PolicyDecision } from "@weaver/config-policy";
import type { ConfigurationPropertySchema, ConfigAuditEntry } from "@weaver/config-types";
import type { ConfigAuditLog } from "@weaver/config-server";
import type { OverrideTracker } from "@weaver/config-policy";
import { evaluateChangePolicy } from "@weaver/config-policy";
import { jsonResponse } from "./router.js";

const VALID_ROLES: ReadonlySet<string> = new Set([
  "platform-ops", "tenant-admin", "scope-admin", "integrator",
  "user", "support", "system", "service", "platform-service",
]);

/**
 * Extracts a PolicyEvaluationContext from request headers.
 * Maps: x-user-id, x-tenant-id, x-roles (comma-separated),
 * x-session-mode, x-override-reason.
 */
export function extractAccessContext(
  headers: Record<string, string>,
): PolicyEvaluationContext {
  const roles = (headers["x-roles"] ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter((r): r is ConfigurationRole => VALID_ROLES.has(r));

  const ctx: PolicyEvaluationContext = {
    userId: headers["x-user-id"] ?? "anonymous",
    tenantId: headers["x-tenant-id"] ?? "",
    roles,
  };

  if (headers["x-session-mode"] === "emergency-override") {
    ctx.sessionMode = "emergency-override";
  }

  if (headers["x-override-reason"] !== undefined) {
    ctx.overrideReason = headers["x-override-reason"];
  }

  return ctx;
}

export interface PolicyCheckDeps {
  schemaMap?: Map<string, ConfigurationPropertySchema> | undefined;
  auditLog?: ConfigAuditLog | undefined;
  overrideTracker?: OverrideTracker | undefined;
}

/**
 * Evaluates policy for a config mutation. Returns a rejection Response
 * if the policy denies the write, or undefined if allowed.
 */
export function checkPolicy(
  key: string,
  deps: PolicyCheckDeps,
  context: PolicyEvaluationContext,
  layer: string,
): { decision: PolicyDecision; schema: ConfigurationPropertySchema | undefined } {
  const schema = deps.schemaMap?.get(key);
  if (schema === undefined) {
    return { decision: { outcome: "allowed" }, schema: undefined };
  }
  // Dev backend: allow all layer writes, let changePolicy decide
  const alwaysAllowWrite = () => true;
  const decision = evaluateChangePolicy(schema, context, layer, alwaysAllowWrite);
  return { decision, schema };
}

/**
 * Converts a PolicyDecision to an HTTP error response, or returns
 * undefined if the decision is "allowed".
 */
export function policyToResponse(decision: PolicyDecision): Response | undefined {
  switch (decision.outcome) {
    case "allowed":
      return undefined;
    case "requires-promotion":
      return jsonResponse(
        { error: "promotion_required", policy: decision.outcome, instructions: decision.message },
        409,
      );
    case "requires-emergency-auth":
      return jsonResponse({ error: "emergency_auth_required", message: decision.message }, 403);
    case "denied":
      return jsonResponse({ error: "access_denied", reason: decision.reason }, 403);
  }
}

/**
 * Records an audit entry after a successful config mutation.
 */
export async function recordAudit(
  deps: PolicyCheckDeps,
  entry: ConfigAuditEntry,
): Promise<void> {
  if (deps.auditLog !== undefined) {
    await deps.auditLog.append(entry);
  }
}

/**
 * Creates an emergency override record if the write used an emergency override.
 */
export async function recordOverride(
  deps: PolicyCheckDeps,
  params: {
    key: string;
    actor: string;
    reason: string;
    tenantId: string;
    layer: string;
  },
): Promise<void> {
  if (deps.overrideTracker !== undefined) {
    const now = new Date().toISOString();
    await deps.overrideTracker.create({
      id: `override-${Date.now()}`,
      key: params.key,
      actor: params.actor,
      reason: params.reason,
      tenantId: params.tenantId,
      layer: params.layer,
      createdAt: now,
    });
  }
}
