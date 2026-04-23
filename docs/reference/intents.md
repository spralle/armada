# @ghost-shell/intents

## Purpose

Intent resolution runtime and when-clause matching for the Ghost Shell action dispatch system. Intents decouple "what the user wants" from "which plugin handles it", enabling multi-plugin action resolution with predicate-based filtering and disambiguation.

## Installation

```bash
bun add @ghost-shell/intents
```

## Key Exports

### Intent Runtime

```ts
interface ShellIntent {
  type: string;
  facts: IntentFactBag;
}

interface IntentRuntime {
  resolve(
    intent: ShellIntent,
    delegate: IntentResolutionDelegate,
    options?: { preferredActionId?: string },
  ): Promise<IntentResolutionOutcome>;
}

type IntentResolutionOutcome =
  | { kind: "executed"; match: IntentActionMatch; trace: IntentResolutionTrace }
  | { kind: "no-match"; feedback: string; trace: IntentResolutionTrace }
  | { kind: "cancelled"; trace: IntentResolutionTrace };

function createIntentRuntime(
  catalog: RuntimeActionDescriptor[],
  options?: IntentRuntimeOptions,
): IntentRuntime;
```

### Resolution Delegate

The shell provides this to handle UI concerns during resolution:

```ts
interface IntentResolutionDelegate {
  showChooser(
    matches: IntentActionMatch[],
    intent: ShellIntent,
    trace: IntentResolutionTrace,
  ): Promise<IntentActionMatch | null>;
  activatePlugin(pluginId: string, trigger: { type: string; id: string }): Promise<boolean>;
  announce(message: string): void;
}
```

### Action Catalog

```ts
interface RuntimeActionDescriptor {
  pluginId: string;
  pluginName: string;
  actionId: string;
  title: string;
  handler: string;
  intentType: string;
  when: Record<string, unknown>;
  loadMode: string;
  registrationOrder: number;
}

function createActionCatalogFromRegistrySnapshot(
  snapshot: object,
): RuntimeActionDescriptor[];
```

### Standalone Resolution

```ts
function resolveIntent(
  catalog: RuntimeActionDescriptor[],
  intent: ShellIntent,
  matcher?: IntentWhenMatcher,
): IntentResolution;

function resolveIntentWithTrace(
  catalog: RuntimeActionDescriptor[],
  intent: ShellIntent,
  matcher?: IntentWhenMatcher,
): IntentResolutionWithTrace;
```

### When-Clause Matchers

```ts
interface IntentWhenMatcher {
  match(when: Record<string, unknown>, facts: IntentFactBag): PredicateEvaluationResult;
}

function createPredicateWhenMatcher(): IntentWhenMatcher;
function createDefaultIntentWhenMatcher(): IntentWhenMatcher;
```

### Tracing

```ts
interface IntentResolutionTrace {
  intentType: string;
  evaluatedAt: number;
  actions: IntentActionTrace[];
  matched: IntentActionMatch[];
}

interface IntentActionTrace extends RuntimeActionDescriptor {
  intentTypeMatch: boolean;
  predicateMatched: boolean;
  failedPredicates: PredicateFailureTrace[];
}
```

## Examples

```ts
import { createIntentRuntime, createActionCatalogFromRegistrySnapshot } from "@ghost-shell/intents";

const catalog = createActionCatalogFromRegistrySnapshot(registrySnapshot);
const runtime = createIntentRuntime(catalog);

const outcome = await runtime.resolve(
  { type: "entity.open", facts: { "entity.type": "document", "entity.id": "doc-1" } },
  {
    showChooser: async (matches) => matches[0] ?? null,
    activatePlugin: async (pluginId) => true,
    announce: (msg) => console.log(msg),
  },
);

if (outcome.kind === "executed") {
  console.log("Handled by:", outcome.match.pluginId);
}
```
