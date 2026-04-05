import type { PluginContract } from "@armada/plugin-contracts";
import { createDefaultIntentWhenMatcher } from "./intents/matcher/default-when-matcher.js";
import type {
  IntentFactBag,
  IntentWhenMatcher,
  PredicateFailureTrace,
} from "./intents/matcher/contracts.js";

export type { IntentFactBag, PredicateFailureTrace } from "./intents/matcher/contracts.js";

export interface ShellIntent {
  type: string;
  facts: IntentFactBag;
}

export interface RuntimeActionDescriptor {
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

export interface IntentActionMatch extends RuntimeActionDescriptor {
  sortKey: string;
}

export interface IntentActionTrace extends RuntimeActionDescriptor {
  intentTypeMatch: boolean;
  predicateMatched: boolean;
  failedPredicates: PredicateFailureTrace[];
}

export interface IntentResolutionTrace {
  intentType: string;
  evaluatedAt: number;
  actions: IntentActionTrace[];
  matched: IntentActionMatch[];
}

export interface IntentResolutionWithTrace {
  resolution: IntentResolution;
  trace: IntentResolutionTrace;
}

export interface IntentRuntimeOptions {
  matcher?: IntentWhenMatcher;
}

export interface IntentResolutionRequest {
  intent: string;
  context: Readonly<Record<string, string>>;
  args?: unknown;
}

export interface IntentResolutionResult {
  executed: boolean;
  intent: string;
  message: string;
}

export interface IntentRuntime {
  resolveAndExecute(request: IntentResolutionRequest): IntentResolutionResult;
}

export type IntentResolution =
  | {
      kind: "no-match";
      feedback: string;
      matches: [];
    }
  | {
      kind: "single-match";
      feedback: string;
      matches: [IntentActionMatch];
    }
  | {
      kind: "multiple-matches";
      feedback: string;
      matches: IntentActionMatch[];
    };

export function createActionCatalogFromRegistrySnapshot(snapshot: {
  plugins: {
    id: string;
    enabled: boolean;
    loadMode: string;
    contract: PluginContract | null;
  }[];
}): RuntimeActionDescriptor[] {
  const descriptors: RuntimeActionDescriptor[] = [];
  let registrationOrder = 0;

  for (const plugin of snapshot.plugins) {
    if (!plugin.enabled || !plugin.contract) {
      continue;
    }

    const actions = readPluginActions(plugin.contract);
    for (const action of actions) {
      descriptors.push({
        pluginId: plugin.id,
        pluginName: plugin.contract.manifest.name,
        actionId: action.id,
        title: action.title,
        handler: action.handler,
        intentType: action.intentType,
        when: action.when,
        loadMode: plugin.loadMode,
        registrationOrder,
      });
      registrationOrder += 1;
    }
  }

  return descriptors;
}

export function resolveIntent(catalog: RuntimeActionDescriptor[], intent: ShellIntent): IntentResolution {
  return resolveIntentWithTrace(catalog, intent).resolution;
}

export function resolveIntentWithTrace(
  catalog: RuntimeActionDescriptor[],
  intent: ShellIntent,
  options: IntentRuntimeOptions = {},
): IntentResolutionWithTrace {
  const matcher = options.matcher ?? createDefaultIntentWhenMatcher();
  const traces: IntentActionTrace[] = [];
  const matches: IntentActionMatch[] = [];

  for (const action of catalog) {
    if (action.intentType !== intent.type) {
      traces.push({
        ...action,
        intentTypeMatch: false,
        predicateMatched: false,
        failedPredicates: [],
      });
      continue;
    }

    const predicate = matcher.evaluate(action.when, intent.facts);
    traces.push({
      ...action,
      intentTypeMatch: true,
      predicateMatched: predicate.matched,
      failedPredicates: predicate.failedPredicates,
    });

    if (predicate.matched) {
      matches.push({
        ...action,
        sortKey: `${action.pluginId}::${action.actionId}::${action.handler}::${action.registrationOrder}`,
      });
    }
  }

  matches.sort(compareMatchesDeterministically);

  const trace: IntentResolutionTrace = {
    intentType: intent.type,
    evaluatedAt: Date.now(),
    actions: traces,
    matched: [...matches],
  };

  if (matches.length === 0) {
    return {
      resolution: {
        kind: "no-match",
        feedback: `No actions matched intent '${intent.type}'.`,
        matches: [],
      },
      trace,
    };
  }

  if (matches.length === 1) {
    return {
      resolution: {
        kind: "single-match",
        feedback: `Running '${matches[0].title}' automatically.`,
        matches: [matches[0]],
      },
      trace,
    };
  }

  return {
    resolution: {
      kind: "multiple-matches",
      feedback: `Choose an action for intent '${intent.type}' (${matches.length} matches).`,
      matches,
    },
    trace,
  };
}

function compareMatchesDeterministically(a: IntentActionMatch, b: IntentActionMatch): number {
  if (a.pluginId !== b.pluginId) {
    return a.pluginId.localeCompare(b.pluginId);
  }
  if (a.actionId !== b.actionId) {
    return a.actionId.localeCompare(b.actionId);
  }
  if (a.handler !== b.handler) {
    return a.handler.localeCompare(b.handler);
  }
  return a.registrationOrder - b.registrationOrder;
}

function readPluginActions(contract: PluginContract): {
  id: string;
  title: string;
  handler: string;
  intentType: string;
  when: Record<string, unknown>;
}[] {
  const contributes = contract.contributes as
    | { actions?: { id: string; title: string; handler: string; intentType: string; when: Record<string, unknown> }[] }
    | undefined;
  return contributes?.actions ?? [];
}

export function createIntentRuntime(): IntentRuntime {
  return {
    resolveAndExecute(request) {
      return {
        executed: true,
        intent: request.intent,
        message: `Intent '${request.intent}' executed with ${Object.keys(request.context).length} context key(s).`,
      };
    },
  };
}
