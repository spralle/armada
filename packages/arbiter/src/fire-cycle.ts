import type {
  CompiledRule,
  CompiledAction,
  StateChange,
  ArbiterWarning,
  FiringResult,
  OperatorFunction,
} from './contracts.js';
import type { ScopeManager } from './scope.js';
import type { AlphaNetwork } from './alpha-network.js';
import type { Agenda } from './agenda.js';
import type { TruthMaintenanceSystem } from './tms.js';
import { evaluate } from '@ghost/predicate';
import type { ExprNode } from '@ghost/predicate';
import { ArbiterError, ArbiterErrorCode } from './errors.js';
import { isExpression } from './path-utils.js';

// ---------------------------------------------------------------------------
// Limits config
// ---------------------------------------------------------------------------

export interface FireLimits {
  readonly maxCycles: number;
  readonly maxRuleFirings: number;
  readonly warnAtCycles: number;
  readonly warnAtFirings: number;
}

// ---------------------------------------------------------------------------
// Subsystem references needed by the fire cycle
// ---------------------------------------------------------------------------

export interface FireContext {
  readonly scope: ScopeManager;
  readonly network: AlphaNetwork;
  readonly agenda: Agenda;
  readonly tms: TruthMaintenanceSystem;
  readonly compiledRules: ReadonlyMap<string, CompiledRule>;
  readonly operators: Readonly<Record<string, OperatorFunction>>;
  readonly limits: FireLimits;
  readonly ruleConditionState: Map<string, boolean>;
}

// ---------------------------------------------------------------------------
// Expression value resolution
// ---------------------------------------------------------------------------

const NAMESPACE_PREFIXES = ['$ui', '$state', '$meta', '$contributions'];

function isNamespacedRef(ref: string): boolean {
  for (const ns of NAMESPACE_PREFIXES) {
    if (ref === ns || ref.startsWith(ns + '.')) return true;
  }
  return false;
}

function resolveValue(value: unknown, scope: ScopeManager): unknown {
  if (typeof value === 'string' && value.startsWith('$')) {
    const ref = value.slice(1);
    // Namespaced paths keep the $ prefix (e.g. $state.tax → scope.get('$state.tax'))
    const path = isNamespacedRef('$' + ref) ? '$' + ref : ref;
    return scope.get(path);
  }
  if (isExpression(value)) {
    return evaluateExpression(value as Record<string, unknown>, scope);
  }
  return value;
}

function evaluateExpression(
  expr: Record<string, unknown>,
  scope: ScopeManager,
): unknown {
  const keys = Object.keys(expr);
  const opKey = keys.find((k) => k.startsWith('$'));
  if (!opKey) return expr;

  const rawArgs = expr[opKey];
  const args = Array.isArray(rawArgs)
    ? (rawArgs as unknown[]).map((a) => resolveValue(a, scope))
    : [resolveValue(rawArgs, scope)];

  // Delegate to simple inline evaluation for known operators
  return evaluateOperatorInline(opKey, args);
}

function evaluateOperatorInline(op: string, args: unknown[]): unknown {
  switch (op) {
    case '$sum': {
      let total = 0;
      for (const v of args) {
        if (typeof v === 'number') total += v;
      }
      return total;
    }
    case '$multiply': {
      let result = 1;
      for (const v of args) {
        if (typeof v !== 'number') return null;
        result *= v;
      }
      return result;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

export function evaluateCondition(
  rule: CompiledRule,
  scope: ScopeManager,
): boolean {
  const state = scope.getReadView();
  const result = evaluate(rule.condition as ExprNode, state);
  return Boolean(result);
}

// ---------------------------------------------------------------------------
// Rule evaluation (single rule)
// ---------------------------------------------------------------------------

export function reevaluateRule(
  rule: CompiledRule,
  ctx: FireContext,
): void {
  if (!rule.enabled) return;
  const wasActive = ctx.ruleConditionState.get(rule.name) ?? false;
  const isActive = evaluateCondition(rule, ctx.scope);
  ctx.ruleConditionState.set(rule.name, isActive);

  if (isActive && !wasActive) {
    ctx.agenda.addActivation(rule);
    ctx.tms.ruleActivated(rule);
  } else if (isActive && wasActive) {
    // Still true after state change — re-add to agenda for another firing
    ctx.agenda.addActivation(rule);
  } else if (!isActive && wasActive) {
    ctx.agenda.removeActivation(rule.name);
    ctx.tms.ruleDeactivated(rule, ctx.scope);
  }
}

// ---------------------------------------------------------------------------
// Evaluate all rules (initial pass)
// ---------------------------------------------------------------------------

export function evaluateAllRules(ctx: FireContext): void {
  for (const rule of ctx.compiledRules.values()) {
    if (!rule.enabled) continue;
    const isActive = evaluateCondition(rule, ctx.scope);
    const wasActive = ctx.ruleConditionState.get(rule.name) ?? false;
    ctx.ruleConditionState.set(rule.name, isActive);

    if (isActive && !wasActive) {
      ctx.agenda.addActivation(rule);
      ctx.tms.ruleActivated(rule);
    } else if (!isActive && wasActive) {
      ctx.agenda.removeActivation(rule.name);
      ctx.tms.ruleDeactivated(rule, ctx.scope);
    }
  }
}

// ---------------------------------------------------------------------------
// Execute else actions for initially-false rules
// ---------------------------------------------------------------------------

export function executeElseBranches(
  ctx: FireContext,
  changes: StateChange[],
): void {
  for (const rule of ctx.compiledRules.values()) {
    if (!rule.enabled || !rule.elseActions) continue;
    const isActive = ctx.ruleConditionState.get(rule.name) ?? false;
    if (!isActive) {
      const elseChanges = executeActions(rule.elseActions, rule.name, ctx);
      changes.push(...elseChanges);
    }
  }
}

// ---------------------------------------------------------------------------
// Execute a rule's actions
// ---------------------------------------------------------------------------

export function executeActions(
  actions: readonly CompiledAction[],
  ruleName: string,
  ctx: FireContext,
): StateChange[] {
  const changes: StateChange[] = [];
  for (const action of actions) {
    const change = executeSingleAction(action, ruleName, ctx);
    if (change) changes.push(change);
  }
  return changes;
}

function executeSingleAction(
  action: CompiledAction,
  ruleName: string,
  ctx: FireContext,
): StateChange | undefined {
  switch (action.type) {
    case 'set': {
      const value = resolveValue(action.compiledValue, ctx.scope);
      const prev = ctx.scope.get(action.path!);
      ctx.scope.set(action.path!, value, ruleName);
      return { path: action.path!, previousValue: prev, newValue: value, ruleName };
    }
    case 'unset': {
      const prev = ctx.scope.get(action.path!);
      ctx.scope.unset(action.path!, ruleName);
      return { path: action.path!, previousValue: prev, newValue: undefined, ruleName };
    }
    case 'push': {
      const value = resolveValue(action.compiledValue, ctx.scope);
      const prev = ctx.scope.get(action.path!);
      ctx.scope.push(action.path!, value, ruleName);
      const newVal = ctx.scope.get(action.path!);
      return { path: action.path!, previousValue: prev, newValue: newVal, ruleName };
    }
    case 'inc': {
      const value = resolveValue(action.compiledValue, ctx.scope);
      const prev = ctx.scope.get(action.path!);
      ctx.scope.inc(action.path!, value, ruleName);
      const newVal = ctx.scope.get(action.path!);
      return { path: action.path!, previousValue: prev, newValue: newVal, ruleName };
    }
    case 'merge': {
      const value = resolveValue(action.compiledValue, ctx.scope);
      const prev = ctx.scope.get(action.path!);
      ctx.scope.merge(action.path!, value, ruleName);
      const newVal = ctx.scope.get(action.path!);
      return { path: action.path!, previousValue: prev, newValue: newVal, ruleName };
    }
    case 'focus': {
      ctx.agenda.setFocus(action.group!);
      return undefined;
    }
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Propagation: find affected rules and re-evaluate
// ---------------------------------------------------------------------------

function propagateChanges(
  changes: readonly StateChange[],
  ctx: FireContext,
): void {
  const affectedNames = new Set<string>();
  for (const change of changes) {
    for (const rule of ctx.network.getAffectedRules(change.path)) {
      affectedNames.add(rule.name);
    }
  }
  for (const name of affectedNames) {
    const rule = ctx.compiledRules.get(name);
    if (rule?.enabled) reevaluateRule(rule, ctx);
  }
}

// ---------------------------------------------------------------------------
// Main fire cycle
// ---------------------------------------------------------------------------

export function fireCycle(ctx: FireContext): FiringResult {
  const changes: StateChange[] = [];
  const warnings: ArbiterWarning[] = [];
  let rulesFired = 0;
  let cycles = 0;

  evaluateAllRules(ctx);
  executeElseBranches(ctx, changes);

  while (!ctx.agenda.isEmpty()) {
    cycles++;

    if (cycles > ctx.limits.maxCycles) {
      throw new ArbiterError(
        ArbiterErrorCode.CYCLE_LIMIT_EXCEEDED,
        `Cycle limit of ${String(ctx.limits.maxCycles)} exceeded`,
      );
    }
    if (cycles === ctx.limits.warnAtCycles) {
      warnings.push({
        code: ArbiterErrorCode.CYCLE_LIMIT_EXCEEDED,
        message: `Approaching cycle limit (${String(cycles)}/${String(ctx.limits.maxCycles)})`,
      });
    }

    const rule = ctx.agenda.selectNext();
    if (!rule) break;

    const ruleChanges = executeActions(rule.actions, rule.name, ctx);
    changes.push(...ruleChanges);
    rulesFired++;

    if (rulesFired > ctx.limits.maxRuleFirings) {
      throw new ArbiterError(
        ArbiterErrorCode.FIRING_LIMIT_EXCEEDED,
        `Firing limit of ${String(ctx.limits.maxRuleFirings)} exceeded`,
      );
    }
    if (rulesFired === ctx.limits.warnAtFirings) {
      warnings.push({
        code: ArbiterErrorCode.FIRING_LIMIT_EXCEEDED,
        message: `Approaching firing limit (${String(rulesFired)}/${String(ctx.limits.maxRuleFirings)})`,
      });
    }

    propagateChanges(ruleChanges, ctx);
  }

  return { rulesFired, cycles, changes, warnings };
}
