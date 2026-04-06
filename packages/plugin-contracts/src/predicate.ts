import type { PluginContributionPredicate } from "./types.js";

export interface PredicateFactBag {
  [key: string]: unknown;
}

export interface PredicateFailureTrace {
  path: string;
  actual: unknown;
  condition: unknown;
}

export interface PredicateEvaluationResult {
  matched: boolean;
  failedPredicates: PredicateFailureTrace[];
}

export interface ContributionPredicateMatcher {
  readonly id: string;
  evaluate(predicate: PluginContributionPredicate, facts: PredicateFactBag): PredicateEvaluationResult;
}

export function createDefaultContributionPredicateMatcher(): ContributionPredicateMatcher {
  return {
    id: "default-contribution-predicate-matcher",
    evaluate: evaluatePredicateWithDefaultMatcher,
  };
}

export function evaluateContributionPredicate(
  predicate: PluginContributionPredicate | undefined,
  facts: PredicateFactBag,
  matcher: ContributionPredicateMatcher = createDefaultContributionPredicateMatcher(),
): boolean {
  if (predicate === undefined) {
    return true;
  }

  return matcher.evaluate(predicate, facts).matched;
}

function evaluatePredicateWithDefaultMatcher(
  predicate: PluginContributionPredicate,
  facts: PredicateFactBag,
): PredicateEvaluationResult {
  const failedPredicates: PredicateFailureTrace[] = [];

  for (const [path, condition] of Object.entries(predicate)) {
    const actual = getFactValue(facts, path);
    if (!matchesCondition(actual, condition)) {
      failedPredicates.push({
        path,
        actual,
        condition,
      });
    }
  }

  return {
    matched: failedPredicates.length === 0,
    failedPredicates,
  };
}

function getFactValue(facts: PredicateFactBag, path: string): unknown {
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
      applyPredicateOperator(operator, actual, expected),
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

function applyPredicateOperator(operator: string, actual: unknown, expected: unknown): boolean {
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
      return Array.isArray(expected) && expected.some((candidate) => isDeepEqual(actual, candidate));
    case "$nin":
      return Array.isArray(expected) && expected.every((candidate) => !isDeepEqual(actual, candidate));
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

    for (let index = 0; index < left.length; index += 1) {
      if (!isDeepEqual(left[index], right[index])) {
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
