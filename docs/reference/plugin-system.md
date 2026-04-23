# @ghost-shell/plugin-system

## Purpose

Plugin composition, capability registry, predicate evaluation, and compatibility checking. This package wires together plugin contributions from multiple plugins into a unified surface the shell can consume.

## Installation

```bash
bun add @ghost-shell/plugin-system
```

## Key Exports

### Composition

Merge contributions from all enabled plugins into a single composed result:

```ts
function composeEnabledPluginContributions(
  contracts: readonly PluginContract[],
): ComposedPluginContributions;

function composeThemeContributions(
  contracts: readonly PluginContract[],
): ComposedThemeContribution[];
```

Types: `ComposedPluginViewContribution`, `ComposedPluginPartContribution`, `ComposedPluginSlotContribution`, `ComposedPluginSectionContribution`, `ComposedPluginLayerSurfaceContribution`, `PluginContributionSource`.

### Predicate Evaluation

Evaluate `when` clauses on plugin contributions against a fact bag:

```ts
function evaluateContributionPredicate(
  predicate: PluginContributionPredicate | undefined,
  facts: PredicateFactBag,
  matcher?: ContributionPredicateMatcher,
): PredicateEvaluationResult;

function createDefaultContributionPredicateMatcher(): ContributionPredicateMatcher;
```

```ts
interface PredicateEvaluationResult {
  matched: boolean;
  failures: PredicateFailureTrace[];
}
```

### Capability Registry

Manage component and service capabilities provided by plugins:

```ts
function createCapabilityRegistry(): CapabilityRegistry;

interface CapabilityRegistry {
  registerComponents(pluginId: string, module: PluginComponentsModule): void;
  registerServices(pluginId: string, module: PluginServicesModule): void;
  resolveComponent(id: string): unknown | undefined;
  resolveService(id: string): unknown | undefined;
  validateDependencies(context: PluginDependencyValidationContext): CapabilityDependencyFailure[];
}

function pickComponentModuleExport(module: PluginComponentsModule, id: string): unknown | undefined;
function pickServiceModuleExport(module: PluginServicesModule, id: string): unknown | undefined;
```

### Plugin Registry Contract

Read capability data from the plugin registry snapshot:

```ts
function readCapabilityComponents(snapshot: object): Map<string, unknown>;
function readCapabilityServices(snapshot: object): Map<string, unknown>;
```

### Compatibility

Check if a plugin is compatible with the current shell version:

```ts
function evaluateShellPluginCompatibility(
  metadata: PluginCompatibilityMetadata,
): ShellPluginCompatibilityResult;
```

### Context Contribution Registry

```ts
function createContextContributionRegistry(): ContextContributionRegistry;
```

Creates the shell-internal registry for reactive context values and provider composition used by `@ghost-shell/react` hooks.

## Examples

```ts
import {
  composeEnabledPluginContributions,
  createCapabilityRegistry,
  evaluateContributionPredicate,
  createContextContributionRegistry,
} from "@ghost-shell/plugin-system";

// Compose all plugin contributions
const composed = composeEnabledPluginContributions(enabledContracts);

// Evaluate a when-clause
const result = evaluateContributionPredicate(
  { "context.project.type": "web" },
  { "context.project.type": "web" },
);
console.log(result.matched); // true
```
