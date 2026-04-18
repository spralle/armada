import type { ExpressionEngine, ExprNode, RuleDefinition, RuleWrite, RuleWriteIntent } from './contracts.js';
import type { EvaluationScope } from '@ghost/predicate';
import { FormrError } from './errors.js';
import { assertSafeSegment } from '@ghost/predicate';

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
  engine: ExpressionEngine,
  rule: RuleDefinition,
  scope: EvaluationScope,
): readonly RuleWriteIntent[] {
  const condition = engine.evaluate(rule.when, scope);
  if (!condition) return [];

  return rule.writes.map((w: RuleWrite) => ({
    path: w.path,
    value: w.mode === 'delete' ? undefined : engine.evaluate(w.value, scope),
    mode: w.mode,
    ruleId: rule.id,
  }));
}

function evaluateIteration(
  engine: ExpressionEngine,
  rules: readonly RuleDefinition[],
  scope: EvaluationScope,
): readonly RuleWriteIntent[] {
  const writes: RuleWriteIntent[] = [];
  for (const rule of rules) {
    writes.push(...evaluateRuleWrites(engine, rule, scope));
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
    throw new FormrError(
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
      throw new FormrError(
        'FORMR_RULE_DISALLOWED_TARGET',
        `Write to path "${w.path}" by rule "${w.ruleId}" is not in allowed targets`,
      );
    }
  }
}

function resolvePathValue(path: string, scope: EvaluationScope): unknown {
  const parts = path.split('.');
  let current: unknown = scope;
  for (const seg of parts) {
    assertSafeSegment(seg);
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

export function setNestedValue(
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

export function deleteNestedValue(
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
  let current = { ...scope } as Record<string, unknown>;

  for (const w of writes) {
    const segments = w.path.split('.');

    for (const seg of segments) {
      assertSafeSegment(seg);
    }

    const apply = w.mode === 'delete' ? deleteNestedValue : (o: Record<string, unknown>, s: string[]) => setNestedValue(o, s, w.value);
    current = apply(current, segments);
  }

  return current;
}

export function executeRules(
  engine: ExpressionEngine,
  rules: readonly RuleDefinition[],
  initialScope: EvaluationScope,
  config?: RuleExecutionConfig,
): RuleExecutionResult {
  const maxIter = Math.max(config?.maxIterations ?? 16, 1);
  let scope = initialScope;
  const allWrites: RuleWriteIntent[] = [];

  for (let iter = 0; iter < maxIter; iter++) {
    const iterWrites = evaluateIteration(engine, rules, scope);

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
  throw new FormrError(
    'FORMR_RULE_NON_CONVERGENT',
    `Rules did not converge after ${maxIter} iterations. Participating rules: ${ruleIds.join(', ')}`,
  );
}
