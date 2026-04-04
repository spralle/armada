import type { PluginContract } from "@armada/plugin-contracts";

export interface IntentFactBag {
  [key: string]: unknown;
}

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
  const matches = catalog
    .filter((action) => action.intentType === intent.type)
    .filter((action) => evaluatePredicate(action.when, intent.facts))
    .map((action) => ({
      ...action,
      sortKey: `${action.pluginId}::${action.actionId}::${action.handler}::${action.registrationOrder}`,
    }))
    .sort(compareMatchesDeterministically);

  if (matches.length === 0) {
    return {
      kind: "no-match",
      feedback: `No actions matched intent '${intent.type}'.`,
      matches: [],
    };
  }

  if (matches.length === 1) {
    return {
      kind: "single-match",
      feedback: `Running '${matches[0].title}' automatically.`,
      matches: [matches[0]],
    };
  }

  return {
    kind: "multiple-matches",
    feedback: `Choose an action for intent '${intent.type}' (${matches.length} matches).`,
    matches,
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

function evaluatePredicate(predicate: Record<string, unknown>, facts: IntentFactBag): boolean {
  for (const [key, condition] of Object.entries(predicate)) {
    const value = getFactValue(facts, key);
    if (!matchesCondition(value, condition)) {
      return false;
    }
  }
  return true;
}

function getFactValue(facts: IntentFactBag, path: string): unknown {
  if (!path.includes(".")) {
    return facts[path];
  }

  let current: unknown = facts;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function matchesCondition(actual: unknown, condition: unknown): boolean {
  if (isOperatorCondition(condition)) {
    return Object.entries(condition).every(([operator, expected]) =>
      applyOperator(operator, actual, expected),
    );
  }

  return isDeepEqual(actual, condition);
}

function isOperatorCondition(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.keys(value).some((key) => key.startsWith("$"));
}

function applyOperator(operator: string, actual: unknown, expected: unknown): boolean {
  switch (operator) {
    case "$eq":
      return isDeepEqual(actual, expected);
    case "$ne":
      return !isDeepEqual(actual, expected);
    case "$exists": {
      const shouldExist = Boolean(expected);
      const exists = actual !== undefined;
      return shouldExist ? exists : !exists;
    }
    case "$in":
      return Array.isArray(expected) && expected.some((item) => isDeepEqual(actual, item));
    case "$nin":
      return Array.isArray(expected) && expected.every((item) => !isDeepEqual(actual, item));
    case "$gt":
      return compareComparable(actual, expected) > 0;
    case "$gte":
      return compareComparable(actual, expected) >= 0;
    case "$lt":
      return compareComparable(actual, expected) < 0;
    case "$lte":
      return compareComparable(actual, expected) <= 0;
    default:
      return false;
  }
}

function compareComparable(actual: unknown, expected: unknown): number {
  if (typeof actual === "number" && typeof expected === "number") {
    return actual - expected;
  }
  if (typeof actual === "string" && typeof expected === "string") {
    return actual.localeCompare(expected);
  }
  return Number.NaN;
}

function isDeepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    for (let i = 0; i < left.length; i += 1) {
      if (!isDeepEqual(left[i], right[i])) {
        return false;
      }
    }
    return true;
  }

  if (
    left &&
    right &&
    typeof left === "object" &&
    typeof right === "object" &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    const leftEntries = Object.entries(left);
    const rightEntries = Object.entries(right);
    if (leftEntries.length !== rightEntries.length) {
      return false;
    }
    for (const [key, value] of leftEntries) {
      if (!(key in right)) {
        return false;
      }
      if (!isDeepEqual(value, (right as Record<string, unknown>)[key])) {
        return false;
      }
    }
    return true;
  }

  return false;
}
