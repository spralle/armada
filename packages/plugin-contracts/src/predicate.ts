import type { ExprNode, EvaluationScope } from "@ghost/predicate";
import { evaluate as evaluateExpr, PredicateError } from "@ghost/predicate";
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
    if (!matchesCondition(actual, path, condition, facts)) {
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

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function getFactValue(facts: PredicateFactBag, path: string): unknown {
  if (!path.includes(".")) {
    if (DANGEROUS_KEYS.has(path)) {
      return undefined;
    }
    return facts[path];
  }

  let current: unknown = facts;
  for (const segment of path.split(".")) {
    if (DANGEROUS_KEYS.has(segment)) {
      return undefined;
    }
    if (!current || typeof current !== "object" || !(segment in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

/**
 * Match a fact value against a condition, delegating comparison operators
 * to @ghost/predicate's evaluator while preserving deep equality semantics
 * for $eq/$ne/$in/$nin.
 */
function matchesCondition(actual: unknown, path: string, condition: unknown, facts: PredicateFactBag): boolean {
  if (isOperatorCondition(condition)) {
    return Object.entries(condition).every(([operator, expected]) =>
      applyOperator(operator, actual, expected, path, facts),
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

/** Operators that @ghost/predicate handles via its evaluator. */
const DELEGATED_OPERATORS = new Set(["$gt", "$gte", "$lt", "$lte", "$exists"]);

function applyOperator(
  operator: string,
  actual: unknown,
  expected: unknown,
  path: string,
  facts: PredicateFactBag,
): boolean {
  if (DELEGATED_OPERATORS.has(operator)) {
    return evaluateWithPredicateEngine(operator, path, expected, facts);
  }

  switch (operator) {
    case "$eq":
      return isDeepEqual(actual, expected);
    case "$ne":
      return !isDeepEqual(actual, expected);
    case "$in":
      return Array.isArray(expected) && expected.some((candidate) => isDeepEqual(actual, candidate));
    case "$nin":
      return Array.isArray(expected) && expected.every((candidate) => !isDeepEqual(actual, candidate));
    default:
      return false;
  }
}

/**
 * Build an ExprNode AST and delegate evaluation to @ghost/predicate.
 * Catches PredicateError (e.g. type mismatch) and returns false for
 * backward compatibility — the old implementation returned NaN comparisons
 * which always yielded false.
 */
function evaluateWithPredicateEngine(
  operator: string,
  path: string,
  expected: unknown,
  facts: PredicateFactBag,
): boolean {
  const pathNode: ExprNode = { kind: "path", path };
  const literalNode = toLiteralNode(expected);

  const astNode: ExprNode = operator === "$exists"
    ? { kind: "op", op: "$exists", args: [pathNode, literalNode] }
    : { kind: "op", op: operator, args: [pathNode, literalNode] };

  const scope: EvaluationScope = { data: facts, uiState: {}, meta: {} };

  try {
    return Boolean(evaluateExpr(astNode, scope));
  } catch (error: unknown) {
    if (error instanceof PredicateError) {
      return false;
    }
    throw error;
  }
}

function toLiteralNode(value: unknown): ExprNode {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return { kind: "literal", value };
  }
  if (value === null) {
    return { kind: "literal", value: null };
  }
  // For non-primitive values (arrays for $in/$nin handled separately),
  // fall back to boolean coercion for $exists
  return { kind: "literal", value: Boolean(value) };
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
