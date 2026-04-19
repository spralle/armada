export { type ExprNode, type ExpressionDefinition, type EvaluationScope } from './ast.js';
export { PredicateError, type PredicateErrorCode } from './errors.js';
export { compile, type CompileOptions } from './compiler.js';
export { OperatorRegistry, type OperatorDefinition, type CustomOperatorFn, type CustomOperatorEntry } from './operators.js';
export { evaluate, type EvaluateOptions } from './evaluator.js';
export { assertSafeSegment, DANGEROUS_KEYS } from './safe-path.js';
export { compileShorthand, type ShorthandQuery } from './shorthand.js';
export {
  evaluateWithTrace,
  type PredicateFailureTrace,
  type EvaluateWithTraceResult,
} from './failure-trace.js';
