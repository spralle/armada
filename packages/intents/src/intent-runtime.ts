import type { PluginContract } from "@ghost-shell/contracts/plugin";
import type { IntentFactBag, IntentWhenMatcher, PredicateFailureTrace } from "./matcher/contracts.js";
import { createPredicateWhenMatcher } from "./matcher/predicate-when-matcher.js";

export type { IntentFactBag, PredicateFailureTrace } from "./matcher/contracts.js";

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
  loadStrategy: string;
  registrationOrder: number;
}

export interface IntentActionMatch extends RuntimeActionDescriptor {
  sortKey: string;
}

export interface IntentSession {
  readonly intent: ShellIntent;
  readonly matches: IntentActionMatch[];
  readonly trace: IntentResolutionTrace;
  chooserFocusIndex: number;
  returnFocusSelector: string | null;
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

export interface IntentResolutionDelegate {
  showChooser(
    matches: IntentActionMatch[],
    intent: ShellIntent,
    trace: IntentResolutionTrace,
  ): Promise<IntentActionMatch | null>;
  activatePlugin(pluginId: string, trigger: { type: string; id: string }): Promise<boolean>;
  announce(message: string): void;
}

export type IntentResolutionOutcome =
  | { kind: "executed"; match: IntentActionMatch; trace: IntentResolutionTrace }
  | { kind: "no-match"; feedback: string; trace: IntentResolutionTrace }
  | { kind: "cancelled"; trace: IntentResolutionTrace };

export interface IntentRuntime {
  resolve(
    intent: ShellIntent,
    delegate: IntentResolutionDelegate,
    options?: { preferredActionId?: string },
  ): Promise<IntentResolutionOutcome>;
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
    loadStrategy: string;
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
        loadStrategy: plugin.loadStrategy,
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
  const matcher = options.matcher ?? createPredicateWhenMatcher();
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
    | { actions?: { id: string; title: string; intent: string; when?: Record<string, unknown> }[] }
    | undefined;
  return (contributes?.actions ?? []).map((action) => ({
    id: action.id,
    title: action.title,
    handler: action.id,
    intentType: action.intent,
    when: action.when ?? {},
  }));
}

export interface IntentRuntimeDeps {
  getRegistrySnapshot: () => {
    plugins: {
      id: string;
      enabled: boolean;
      loadStrategy: string;
      contract: PluginContract | null;
    }[];
  };
}

export function createIntentRuntime(deps: IntentRuntimeDeps): IntentRuntime {
  return {
    async resolve(intent, delegate, options) {
      const catalog = createActionCatalogFromRegistrySnapshot(deps.getRegistrySnapshot());
      const { resolution, trace } = resolveIntentWithTrace(catalog, intent);

      if (resolution.kind === "no-match") {
        delegate.announce(resolution.feedback);
        return { kind: "no-match", feedback: resolution.feedback, trace };
      }

      // Determine which match to execute
      let match: IntentActionMatch;

      if (resolution.kind === "single-match") {
        match = resolution.matches[0];
      } else {
        // multiple-matches
        if (options?.preferredActionId) {
          const preferred = resolution.matches.find((m) => m.actionId === options.preferredActionId);
          if (preferred) {
            match = preferred;
          } else {
            const chosen = await delegate.showChooser(resolution.matches, intent, trace);
            if (!chosen) {
              return { kind: "cancelled", trace };
            }
            match = chosen;
          }
        } else {
          const chosen = await delegate.showChooser(resolution.matches, intent, trace);
          if (!chosen) {
            return { kind: "cancelled", trace };
          }
          match = chosen;
        }
      }

      delegate.announce(resolution.feedback);
      const activated = await delegate.activatePlugin(match.pluginId, {
        type: "intent",
        id: intent.type,
      });

      if (!activated) {
        delegate.announce(`Failed to activate plugin '${match.pluginId}'.`);
        return { kind: "no-match", feedback: `Plugin activation failed.`, trace };
      }

      return { kind: "executed", match, trace };
    },
  };
}
