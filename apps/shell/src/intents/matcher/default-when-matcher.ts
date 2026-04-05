import type {
  IntentFactBag,
  IntentWhenMatcher,
  PredicateFailureTrace,
  PredicateEvaluationResult,
} from "./contracts.js";

export function createDefaultIntentWhenMatcher(): IntentWhenMatcher {
  return {
    id: "default-when-matcher",
    evaluate: evaluatePredicate,
  };
}

function evaluatePredicate(
  predicate: Record<string, unknown>,
  facts: IntentFactBag,
): PredicateEvaluationResult {
  const failedPredicates: PredicateFailureTrace[] = [];
  for (const [key, condition] of Object.entries(predicate)) {
    const value = getFactValue(facts, key);
    if (!matchesCondition(value, condition)) {
      failedPredicates.push({
        path: key,
        actual: value,
        condition,
      });
    }
  }

  return {
    matched: failedPredicates.length === 0,
    failedPredicates,
  };
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
