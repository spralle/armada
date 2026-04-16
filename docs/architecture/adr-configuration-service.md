# ADR: Layered configuration service design decisions

## Status

Accepted (2026-04-12)

## Context

Ghost is a multi-tenant maritime platform with a plugin-based micro-frontend shell architecture. Configuration needs span from platform-level hardcoded defaults to per-user preferences, with tenant-defined organizational hierarchies in between. The existing `migration-flags.ts` provides a primitive 3-tier override pattern. We need a general-purpose, formally designed configuration system that supports deep merge with N layers, tenant-defined dynamic scope hierarchies, plugin-scoped access with namespace isolation, risk-based change promotion, defense-in-depth access control, expression-aware values, and both backend and frontend consumption.

## Decision

### Merge & resolution

**1) Deep merge strategy.** Objects merge recursively, arrays replace, primitives replace. `null` explicitly clears a key (removes inherited value). `undefined` skips (inherits from lower layer).

**2) Layer stack.** Fixed ordering: CORE → APP → MODULE → INTEGRATOR → TENANT → [dynamic scope chain] → USER → DEVICE → SESSION. Higher layers override lower layers per the merge strategy.

### Scope chain

**3) Dynamic scope chain.** Tenant-defined hierarchy with variable depth (e.g., fleet → vessel → voyage). Resolved per business object context, not per user session. Scope chain is walked from broadest to narrowest between TENANT and USER layers.

### Key format

**4) Key format.** Dotted segments: `{namespace}.{category}.{setting}`, 3–5 segments, camelCase. Example: `ghost.theme.sidebar.collapsed`.

**5) Plugin declaration.** Plugins declare config with relative keys, auto-prefixed with the plugin's namespace at composition time.

**6) Plugin reading.** Local namespace by default via `ScopedConfigurationService`. Cross-namespace access requires explicit `root` accessor.

### Schema & types

**7) View/component config.** Independent declarations co-located with components (`*.config.ts`). NOT bundled in the plugin contract — discovered separately at build time.

**8) TypeScript-first.** TS types are the source of truth for config schemas. Zod validators and JSON Schema are generated at build time.

**9) Schema ownership.** One owner per key, validated at composition time. No cross-namespace schema declaration allowed.

### Expressions

**10) Expressions.** Pluggable `ExpressionEvaluatorProvider` interface. MongoDB-like query expressions supported. The config engine stores expressions as opaque values and delegates evaluation to the provider.

### Storage

**11) Git storage.** JSON files only. `config/` directory structure with base + environment overlays.

**12) Environment handling.** Environment resolution is a provider concern. The resolution engine is environment-agnostic.

**13) Pluggable storage.** `ConfigurationStorageProvider` interface per layer. Each layer can use a different backend (git, API, localStorage, IndexedDB).

**14) Offline sync.** Deferred. `SyncableStorageProvider` interface defined but not implemented in iteration 1.

### State management

**15) State management.** Start with a lightweight EventEmitter-based state container. Evaluate Valtio later for React binding needs. State management is an internal implementation detail — not exposed in the public API.

### Change management

**16) Promotion.** Risk-based `changePolicy` per config key: `full-pipeline`, `staging-gate`, `direct-allowed`, `emergency-override`.

**17) Git as SSOT.** CORE/APP/MODULE/INTEGRATOR/TENANT/SCOPE layers stored through git. Tenant admin changes go through an API→Git writer. USER and DEVICE layers are NOT stored in git (localStorage/IndexedDB).

**18) Accept latency.** Git-based config changes are not real-time. Acceptable tradeoff for auditability and consistency guarantees.

### Session

**19) Session layer.** Ephemeral, in-memory only. Placeholder type in iteration 1; full design (GodModeSession, transient installs, safety guardrails) deferred to iteration 6.

### Security & access

**20) Emergency override.** Formalized flow: elevated auth required, full audit trail, mandatory 24h follow-up review. Bypasses `maxOverrideLayer` ceiling.

**21) Permissions.** Defense in depth: layer write authority (who can write to which layer) + key visibility/writeRestriction (per-key ACL) + `maxOverrideLayer` ceiling (prevents lower-authority layers from overriding higher-authority values).

**22) Tenant isolation.** Non-negotiable. API filters by tenant context at every access point. No cross-tenant config leakage.

### Backend

**23) Backend services.** Same config system, consumed via `ServiceConfigurationService`. Namespace-restricted. `reloadBehavior` per key controls whether changes require restart or are applied live.

### Integration

**24) Package.json sharing.** Plugin contracts read `version` and `id` from `package.json`. `package.json` CANNOT replace the plugin contract — it supplements it.

### Packaging

**25) Three packages.** `@weaver/config-types` (types + schemas, zero runtime deps), `@weaver/config-engine` (pure resolution functions), `@weaver/config-providers` (storage I/O implementations).

## Consequences

**Positive:**

- Clean separation between types (zero deps), engine (pure functions), and storage (I/O).
- Plugin authors declare config in contracts without knowing storage details.
- Tenant isolation is enforced at every layer.
- Schema composition at build time catches conflicts early.
- Emergency override provides an escape hatch with accountability.

**Negative / tradeoffs:**

- Git-based storage for tenant config accepts latency (not real-time).
- Dynamic scope chain adds resolution complexity.
- Three packages add build/dependency overhead (mitigated by monorepo tooling).
- State management decision deferred — may need re-evaluation when React binding requirements emerge.

## Related

- `docs/configuration.md` — User-facing documentation
- `packages/config-types/` — Type definitions
- `packages/config-engine/` — Pure resolution functions
- `packages/config-providers/` — Storage implementations (scaffold)
- `packages/plugin-contracts/src/types.ts` — PluginConfigurationContribution bridge
