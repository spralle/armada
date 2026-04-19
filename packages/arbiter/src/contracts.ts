// ---------------------------------------------------------------------------
// ThenAction — discriminated union of mutation operations (ADR §2.2)
// ---------------------------------------------------------------------------

export interface ThenSetAction {
  readonly type: 'set';
  readonly path: string;
  readonly value: ThenValue;
}

export interface ThenUnsetAction {
  readonly type: 'unset';
  readonly path: string;
}

export interface ThenPushAction {
  readonly type: 'push';
  readonly path: string;
  readonly value: ThenValue;
}

export interface ThenPullAction {
  readonly type: 'pull';
  readonly path: string;
  readonly match: Record<string, unknown>;
}

export interface ThenIncAction {
  readonly type: 'inc';
  readonly path: string;
  readonly value: ThenValue;
}

export interface ThenMergeAction {
  readonly type: 'merge';
  readonly path: string;
  readonly value: ThenValue;
}

export interface ThenFocusAction {
  readonly type: 'focus';
  readonly group: string;
}

export type ThenAction =
  | ThenSetAction
  | ThenUnsetAction
  | ThenPushAction
  | ThenPullAction
  | ThenIncAction
  | ThenMergeAction
  | ThenFocusAction;

// ---------------------------------------------------------------------------
// ThenValue (ADR §2.3)
// Plain values are literals; objects with $ keys are aggregation expressions.
// Intentionally `unknown` — validated at compile time, not type level.
// ---------------------------------------------------------------------------

export type ThenValue = unknown;

// ---------------------------------------------------------------------------
// ProductionRule (ADR §2.1)
// ---------------------------------------------------------------------------

export interface ProductionRule {
  readonly name: string;
  readonly when: Record<string, unknown>;
  readonly then: readonly ThenAction[];
  readonly else?: readonly ThenAction[] | undefined;
  readonly salience?: number | undefined;
  readonly activationGroup?: string | undefined;
  readonly onConflict?: 'override' | 'warn' | 'error' | undefined;
  readonly enabled?: boolean | undefined;
  readonly description?: string | undefined;
}

// ---------------------------------------------------------------------------
// Session configuration (ADR §3)
// ---------------------------------------------------------------------------

export type OperatorFunction = (
  args: readonly unknown[],
  scope: Readonly<Record<string, unknown>>,
) => unknown;

export interface OperatorRegistryConfig {
  readonly custom?: Readonly<Record<string, OperatorFunction>> | undefined;
}

export interface SessionLimits {
  readonly maxCycles?: number | undefined;
  readonly maxRuleFirings?: number | undefined;
  readonly warnAtCycles?: number | undefined;
  readonly warnAtFirings?: number | undefined;
}

export interface TmsConfig {
  readonly autoRetract?: 'ui-contributions' | 'all' | undefined;
}

export interface SessionConfig {
  readonly rules?: readonly ProductionRule[] | undefined;
  readonly initialState?: Readonly<Record<string, unknown>> | undefined;
  readonly operators?: OperatorRegistryConfig | undefined;
  readonly limits?: SessionLimits | undefined;
  readonly tms?: TmsConfig | undefined;
  readonly validation?: 'strict' | 'syntax' | 'none' | undefined;
  readonly errorHandling?: 'strict' | 'lenient' | undefined;
}

// ---------------------------------------------------------------------------
// Firing result & diagnostics (ADR §3)
// ---------------------------------------------------------------------------

import type { ArbiterErrorCode } from './errors.js';

export interface StateChange {
  readonly path: string;
  readonly previousValue: unknown;
  readonly newValue: unknown;
  readonly ruleName: string;
}

export interface ArbiterWarning {
  readonly code: ArbiterErrorCode;
  readonly message: string;
  readonly ruleName?: string | undefined;
}

export interface FiringResult {
  readonly rulesFired: number;
  readonly cycles: number;
  readonly changes: readonly StateChange[];
  readonly warnings: readonly ArbiterWarning[];
}

// ---------------------------------------------------------------------------
// RuleSession — main API surface (ADR §3)
// ---------------------------------------------------------------------------

export type SubscriptionCallback = (value: unknown, previousValue: unknown) => void;
export type Unsubscribe = () => void;

export interface RuleSession {
  readonly registerRule: (rule: ProductionRule) => void;
  readonly removeRule: (name: string) => void;
  readonly assert: (path: string, value: unknown) => void;
  readonly retract: (path: string) => void;
  readonly fire: () => FiringResult;

  readonly subscribe: (path: string, callback: SubscriptionCallback) => Unsubscribe;
  readonly update: (path: string, value: unknown) => FiringResult;

  readonly getState: () => Readonly<Record<string, unknown>>;
  readonly getPath: (path: string) => unknown;

  readonly setFocus: (group: string) => void;

  readonly dispose: () => void;
}

// ---------------------------------------------------------------------------
// WriteRecord — TMS provenance tracking
// ---------------------------------------------------------------------------

export interface WriteRecord {
  readonly path: string;
  readonly value: unknown;
  readonly snapshotValue: unknown;
  readonly ruleName: string;
}

// ---------------------------------------------------------------------------
// Compiled internal types (not exported from main barrel)
// ---------------------------------------------------------------------------

export interface CompiledRule {
  readonly name: string;
  readonly condition: unknown;
  readonly actions: readonly CompiledAction[];
  readonly elseActions?: readonly CompiledAction[] | undefined;
  readonly salience: number;
  readonly activationGroup?: string | undefined;
  readonly onConflict: 'override' | 'warn' | 'error';
  readonly enabled: boolean;
  readonly hasTms: boolean;
  readonly source: ProductionRule;
}

export interface CompiledAction {
  readonly type: ThenAction['type'];
  readonly path?: string | undefined;
  readonly group?: string | undefined;
  readonly compiledValue?: unknown;
  readonly compiledMatch?: unknown;
}
