// Public types — rule definitions
export type {
  ProductionRule,
  ThenAction,
  ThenSetAction,
  ThenUnsetAction,
  ThenPushAction,
  ThenPullAction,
  ThenIncAction,
  ThenMergeAction,
  ThenFocusAction,
  ThenValue,
} from './contracts.js';

// Public types — session configuration
export type {
  SessionConfig,
  SessionLimits,
  TmsConfig,
  OperatorRegistryConfig,
  OperatorFunction,
} from './contracts.js';

// Public types — session API
export type { RuleSession, SubscriptionCallback, Unsubscribe } from './contracts.js';

// Public types — results & diagnostics
export type { FiringResult, StateChange, ArbiterWarning, WriteRecord } from './contracts.js';

// Error types
export { ArbiterError, ArbiterErrorCode } from './errors.js';
