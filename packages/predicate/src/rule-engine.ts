import type { RuleDefinition, RuleWrite } from './ast.js';
import type { EvaluationScope } from './evaluator.js';
import { evaluate } from './evaluator.js';
import { PredicateError } from './errors.js';

export interface RuleWriteIntent {
  readonly path: string;
  readonly value: unknown;
  readonly mode: 'set' | 'delete';
  readonly ruleId: string;
}

export interface RuleExecutionConfig {
  readonly maxIterations?: number;
  readonly allowedWriteTargets?: readonly string[];
}

export interface RuleExecutionResult {
  readonly writes: readonly RuleWriteIntent[];
  readonly iterations: number;
  readonly converged: boolean;
}

function evaluateRuleWrites(
  rule: RuleDefinition,
  scope: EvaluationScope,
): readonly RuleWriteIntent[] {
  const condition = evaluate(rule.when, scope);
  if (!condition) return [];

  return rule.writes.map((w: RuleWrite) => ({
    path: w.path,
    value: w.mode === 'delete' ? undefined : evaluate(w.value, scope),
    mode: w.mode,
    ruleId: rule.id,
  }));
}

function evaluateIteration(
  rules: readonly RuleDefinition[],
  scope: EvaluationScope,
): readonly RuleWriteIntent[] {
  const writes: RuleWriteIntent[] = [];
  for (const rule of rules) {
    writes.push(...evaluateRuleWrites(rule, scope));
  }
  return writes;
}

function checkWriteConflicts(writes: readonly RuleWriteIntent[]): void {
  const byPath = new Map<string, RuleWriteIntent>();
  for (const w of writes) {
    const existing = byPath.get(w.path);
    if (!existing) {
      byPath.set(w.path, w);
      continue;
    }
    if (existing.mode === w.mode && existing.value === w.value) continue;
    throw new PredicateError(
      'FORMR_RULE_WRITE_CONFLICT',
      `Write conflict on path "${w.path}" between rules "${existing.ruleId}" and "${w.ruleId}"`,
    );
  }
}

function checkAllowedTargets(
  writes: readonly RuleWriteIntent[],
  allowed: readonly string[],
): void {
  for (const w of writes) {
    const ok = allowed.some((prefix) => w.path.startsWith(prefix));
    if (!ok) {
      throw new PredicateError(
        'FORMR_RULE_DISALLOWED_TARGET',
        `Write to path "${w.path}" by rule "${w.ruleId}" is not in allowed targets`,
      );
    }
  }
}

function resolvePathValue(path: string, scope: EvaluationScope): unknown {
  const segments = path.startsWith('$ui.')
    ? { root: scope.uiState, parts: path.slice(4).split('.') }
    : path.startsWith('$meta.')
      ? { root: scope.meta, parts: path.slice(6).split('.') }
      : { root: scope.data, parts: path.split('.') };

  let current: unknown = segments.root;
  for (const seg of segments.parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

function filterNetWrites(
  writes: readonly RuleWriteIntent[],
  scope: EvaluationScope,
): readonly RuleWriteIntent[] {
  return writes.filter((w) => {
    if (w.mode === 'delete') {
      return resolvePathValue(w.path, scope) !== undefined;
    }
    return resolvePathValue(w.path, scope) !== w.value;
  });
}

function setNestedValue(
  obj: Record<string, unknown>,
  segments: string[],
  value: unknown,
): Record<string, unknown> {
  if (segments.length === 1) {
    return { ...obj, [segments[0]]: value };
  }
  const [head, ...rest] = segments;
  const child = (obj[head] ?? {}) as Record<string, unknown>;
  return { ...obj, [head]: setNestedValue(child, rest, value) };
}

function deleteNestedValue(
  obj: Record<string, unknown>,
  segments: string[],
): Record<string, unknown> {
  if (segments.length === 1) {
    const { [segments[0]]: _, ...rest } = obj;
    return rest;
  }
  const [head, ...rest] = segments;
  const child = obj[head];
  if (child === null || child === undefined || typeof child !== 'object') return obj;
  return { ...obj, [head]: deleteNestedValue(child as Record<string, unknown>, rest) };
}

function applyWrites(
  scope: EvaluationScope,
  writes: readonly RuleWriteIntent[],
): EvaluationScope {
  let data = (scope.data ?? {}) as Record<string, unknown>;
  let uiState = (scope.uiState ?? {}) as Record<string, unknown>;
  let meta = (scope.meta ?? {}) as Record<string, unknown>;

  for (const w of writes) {
    let target: 'data' | 'ui' | 'meta' = 'data';
    let segments: string[];

    if (w.path.startsWith('$ui.')) {
      target = 'ui';
      segments = w.path.slice(4).split('.');
    } else if (w.path.startsWith('$meta.')) {
      target = 'meta';
      segments = w.path.slice(6).split('.');
    } else {
      segments = w.path.split('.');
    }

    const apply = w.mode === 'delete' ? deleteNestedValue : (o: Record<string, unknown>, s: string[]) => setNestedValue(o, s, w.value);

    if (target === 'ui') uiState = apply(uiState, segments);
    else if (target === 'meta') meta = apply(meta, segments);
    else data = apply(data, segments);
  }

  return { data, uiState, meta };
}

export function executeRules(
  rules: readonly RuleDefinition[],
  initialScope: EvaluationScope,
  config?: RuleExecutionConfig,
): RuleExecutionResult {
  const maxIter = Math.max(config?.maxIterations ?? 16, 1);
  let scope = initialScope;
  const allWrites: RuleWriteIntent[] = [];

  for (let iter = 0; iter < maxIter; iter++) {
    const iterWrites = evaluateIteration(rules, scope);

    checkWriteConflicts(iterWrites);

    if (config?.allowedWriteTargets) {
      checkAllowedTargets(iterWrites, config.allowedWriteTargets);
    }

    const netWrites = filterNetWrites(iterWrites, scope);

    if (netWrites.length === 0) {
      return { writes: allWrites, iterations: iter + 1, converged: true };
    }

    scope = applyWrites(scope, netWrites);
    allWrites.push(...netWrites);
  }

  const ruleIds = [...new Set(allWrites.map((w) => w.ruleId))];
  throw new PredicateError(
    'FORMR_RULE_NON_CONVERGENT',
    `Rules did not converge after ${maxIter} iterations. Participating rules: ${ruleIds.join(', ')}`,
  );
}
