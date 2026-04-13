export interface IntentFactBag {
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

export interface IntentWhenMatcher {
  readonly id: string;
  evaluate(when: Record<string, unknown>, facts: IntentFactBag): PredicateEvaluationResult;
}
