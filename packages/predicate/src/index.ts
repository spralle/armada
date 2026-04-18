export { type ExprNode, type ExpressionDefinition, type RuleDefinition, type RuleWrite } from './ast.js';
export { PredicateError, type PredicateErrorCode } from './errors.js';
export { compile, type CompileOptions } from './compiler.js';
export { OperatorRegistry, type OperatorDefinition } from './operators.js';
export { evaluate, type EvaluationScope, type EvaluateOptions } from './evaluator.js';
export { assertSafeSegment } from './safe-path.js';
export { executeRules, type RuleWriteIntent, type RuleExecutionConfig, type RuleExecutionResult } from './rule-engine.js';
