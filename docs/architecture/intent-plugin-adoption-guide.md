# Intent Plugin Adoption Guide

How to make your plugin participate in the intent framework's polymorphic action resolution.

## 1. Shared Intent Type Conventions

Intent types follow `domain.entity.<verb>` naming. Constants are defined in
`packages/plugin-contracts/src/domain-intents.ts` and exported from `@ghost-shell/contracts`:

```ts
import {
  INTENT_ENTITY_OPEN,    // "domain.entity.open"
  INTENT_ENTITY_INSPECT, // "domain.entity.inspect"
  INTENT_ENTITY_ASSIGN,  // "domain.entity.assign"
} from "@ghost-shell/contracts";
```

These are plain string constants, not enums. Any plugin can introduce new intent types by using
a new string literal — no central registration required. Use shared constants when multiple
plugins need to respond to the same semantic intent.

## 2. PluginActionContribution Fields

Declare actions in your plugin contract's `contributes.actions` array. Each entry has:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique action identifier, e.g. `"domain.unplanned-orders.open"` |
| `title` | `string` | Human-readable label shown in the action palette and chooser |
| `intent` | `string` | The shared intent type this action handles |
| `predicate?` | `Record<string, unknown>` | Optional condition evaluated against intent facts |

> Defined in `packages/plugin-contracts/src/types.ts` (`PluginActionContribution`).

**Example** (from `plugins/domain-unplanned-orders-plugin/src/plugin-contract.ts`):

```ts
import type { PluginContract } from "@ghost-shell/contracts";
import { INTENT_ENTITY_OPEN, INTENT_ENTITY_INSPECT } from "@ghost-shell/contracts";

const pluginContract: PluginContract = {
  manifest: { id: "ghost.domain.unplanned-orders", name: "Unplanned Orders", version: "0.1.0" },
  contributes: {
    actions: [
      {
        id: "domain.unplanned-orders.open",
        title: "Open Unplanned Orders",
        intent: INTENT_ENTITY_OPEN,
        predicate: { entityType: { $eq: "order" } },
      },
      {
        id: "domain.unplanned-orders.inspect",
        title: "Inspect Order Details",
        intent: INTENT_ENTITY_INSPECT,
        predicate: { entityType: { $eq: "order" } },
      },
    ],
  },
};
```

## 3. Predicate Patterns

Predicates gate when an action is eligible. They are evaluated against the `facts` object
supplied when an intent is fired.

> Matcher implementation: `apps/shell/src/intents/matcher/default-when-matcher.ts`

### Operators

| Operator | Meaning |
|----------|---------|
| `$eq` | Equals |
| `$ne` | Not equals |
| `$exists` | Property exists (boolean) |
| `$in` | Value in array |
| `$nin` | Value not in array |
| `$gt` | Greater than |
| `$gte` | Greater than or equal |
| `$lt` | Less than |
| `$lte` | Less than or equal |

### Syntax

```ts
// Operator object form
{ entityType: { $eq: "order" } }

// Bare value shorthand (equivalent to $eq)
{ entityType: "order" }

// Multiple keys are AND'd
{ entityType: { $eq: "order" }, context: { $eq: "planning" } }

// Existence check
{ assignee: { $exists: true } }

// Set membership
{ entityType: { $in: ["order", "cargo"] } }
```

## 4. Handler Registration

Handlers are registered in `plugin-activate.ts` via the `api.actions.registerAction` API.
Push the returned disposable into `ctx.subscriptions` for proper lifecycle cleanup.

**Example** (from `plugins/domain-unplanned-orders-plugin/src/plugin-activate.ts`):

```ts
import type { GhostApi, ActivationContext } from "@ghost-shell/contracts";

function activate(api: GhostApi, ctx: ActivationContext): void {
  ctx.subscriptions.push(
    api.actions.registerAction("domain.unplanned-orders.open", async () => {
      console.info("[unplanned-orders] open action invoked");
    }),
  );
  ctx.subscriptions.push(
    api.actions.registerAction("domain.unplanned-orders.inspect", async () => {
      console.info("[unplanned-orders] inspect action invoked");
    }),
  );
}

export { activate };
```

**Key points:**

- The action `id` in `registerAction` must match the `id` declared in the plugin contract.
- Handlers currently receive no arguments — intent facts are not passed to handlers.
- Always use `ctx.subscriptions.push()` so handlers are disposed when the plugin deactivates.

## 5. Resolution Flow and Chooser Behavior

When an intent is fired with `{ type, facts }`, the framework resolves it through these steps:

```
Intent fired → Build candidate catalog → Evaluate predicates → Resolve
```

1. **Catalog**: All registered actions whose `intent` matches the fired type are collected.
2. **Predicate evaluation**: Each candidate's `predicate` (if present) is tested against the
   supplied `facts`. Actions without a predicate always match.
3. **Resolution**:

| Matches | Behavior |
|---------|----------|
| **1** | Auto-execute — the single matching handler runs immediately |
| **0** | Announce "no actions matched" — no handler is invoked |
| **N > 1** | Chooser UI shown — user picks which action to run |

4. **Preferred action ID**: Callers can supply a specific action ID to bypass the chooser
   (action-by-ID dispatch). If the preferred action exists and its predicate passes, it
   runs directly.
5. **Trace**: Every resolution records a diagnostic trace for debugging.

### Polymorphism in practice

Two plugins can both declare `intent: INTENT_ENTITY_OPEN` with different predicates:

- **Unplanned Orders**: `predicate: { entityType: { $eq: "order" } }`
- **Vessel View**: `predicate: { entityType: { $eq: "vessel" } }`

Firing `{ type: "domain.entity.open", facts: { entityType: "order" } }` resolves to the
orders plugin. Firing with `{ entityType: "vessel" }` resolves to the vessel plugin. If facts
match both (or neither has a predicate), the chooser appears.
