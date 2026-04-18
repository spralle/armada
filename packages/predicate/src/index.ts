export { type ExprNode, type ExpressionDefinition, type EvaluationScope } from './ast.js';
export { PredicateError, type PredicateErrorCode } from './errors.js';
export { compile, type CompileOptions } from './compiler.js';
export { OperatorRegistry, type OperatorDefinition } from './operators.js';
export { evaluate, type EvaluateOptions } from './evaluator.js';
export { assertSafeSegment, DANGEROUS_KEYS } from './safe-path.js';
