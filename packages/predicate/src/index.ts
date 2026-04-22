// Primary API
export { Predicate, type PredicateOptions } from './predicate.js';

// Compilation
export { compile, type Query } from './compile.js';
export { compileFilter, compileFilterFromAst, compileRawFromAst, type FilterFn, type CompileFilterOptions, clearRegexCache as clearFilterRegexCache, getRegexCacheSize as getFilterRegexCacheSize } from './filter-compiler.js';

// Evaluation (thin facade)
export { evaluate, type EvaluateOptions, clearRegexCache, getRegexCacheSize } from './evaluator.js';

// Diagnostics
export { evaluateWithTrace, type PredicateFailureTrace, type EvaluateWithTraceResult } from './failure-trace.js';

// Extensibility
export { OperatorRegistry, type OperatorDefinition, type CustomOperatorFn, type CustomOperatorEntry } from './operators.js';

// Collections
export { find, type FindOptions } from './collection/find.js';
export { findOne } from './collection/find-one.js';

// Types
export { type ExprNode, type ExpressionDefinition, type EvaluationScope } from './ast.js';
export type { TypedQuery, DotPaths, PathValue, FieldCondition } from './typed-query.js';

// Path utilities
export { validateAndSplitPath, resolveSegments, collectPath, collectArrayLeaves, resolvePath, normalizeComparable, assertComparableTypes, PATH_MISSING } from './path-utils.js';

// Safety
export { assertSafeSegment, DANGEROUS_KEYS } from './safe-path.js';
export { PredicateError, type PredicateErrorCode } from './errors.js';

// Sort utilities
export { compareValues, applySorting } from './sort-utils.js';

// Backward compatibility
export { compileShorthand, type ShorthandQuery } from './compile.js';
