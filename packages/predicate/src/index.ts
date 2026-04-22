// Primary API
export { Predicate } from './predicate.js';

// Compilation
export { compile, type Query } from './compile.js';
export { compileFilter, compileFilterFromAst, type FilterFn, type CompileFilterOptions, clearRegexCache as clearFilterRegexCache, getRegexCacheSize as getFilterRegexCacheSize } from './filter-compiler.js';

// Evaluation (thin facade)
export { evaluate, type EvaluateOptions, clearRegexCache, getRegexCacheSize } from './evaluator.js';

// Diagnostics
export { evaluateWithTrace, type PredicateFailureTrace, type EvaluateWithTraceResult } from './failure-trace.js';

// Extensibility
export { OperatorRegistry, type OperatorDefinition, type CustomOperatorFn, type CustomOperatorEntry } from './operators.js';

// Types
export { type ExprNode, type ExpressionDefinition, type EvaluationScope } from './ast.js';

// Safety
export { assertSafeSegment, DANGEROUS_KEYS } from './safe-path.js';
export { PredicateError, type PredicateErrorCode } from './errors.js';

// Backward compatibility
export { compileShorthand, type ShorthandQuery } from './compile.js';
