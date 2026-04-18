import type { ExprNode } from './ast.js';
import { PredicateError } from './errors.js';
import { OperatorRegistry } from './operators.js';

const defaultRegistry = new OperatorRegistry();

/**
 * Compile a Mongo-like predicate object into an ExprNode AST.
 * Pure and deterministic — same input always yields the same output.
 */
export function compile(input: unknown): ExprNode {
  return compileNode(input, defaultRegistry);
}

function isUnsupportedPrimitive(input: unknown): boolean {
  return typeof input === 'undefined'
    || typeof input === 'symbol'
    || typeof input === 'function'
    || typeof input === 'bigint';
}

function compileNode(input: unknown, registry: OperatorRegistry): ExprNode {
  if (isUnsupportedPrimitive(input)) {
    throw new PredicateError(
      'FORMR_EXPR_COMPILE_UNSUPPORTED_LITERAL',
      `Unsupported literal type: ${typeof input}`,
    );
  }

  if (input === null) {
    return { kind: 'literal', value: null };
  }

  if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
    return { kind: 'literal', value: input };
  }

  if (Array.isArray(input)) {
    throw new PredicateError(
      'FORMR_EXPR_PARSE_INVALID_ROOT',
      'Arrays are not valid predicate roots',
    );
  }

  if (typeof input !== 'object') {
    throw new PredicateError(
      'FORMR_EXPR_COMPILE_UNSUPPORTED_LITERAL',
      `Unsupported input type: ${typeof input}`,
    );
  }

  return compileObject(input as Record<string, unknown>, registry);
}

function compileObject(
  obj: Record<string, unknown>,
  registry: OperatorRegistry,
): ExprNode {
  const keys = Object.keys(obj);

  if (keys.length === 0) {
    throw new PredicateError(
      'FORMR_EXPR_PARSE_INVALID_ROOT',
      'Empty object is not a valid predicate',
    );
  }

  if (keys.length > 1) {
    throw new PredicateError(
      'FORMR_EXPR_COMPILE_AMBIGUOUS_OBJECT',
      `Object has multiple keys and cannot be disambiguated: ${keys.join(', ')}`,
    );
  }

  const key = keys[0]!;

  if (key === '$path') {
    return compilePath(obj[key]);
  }

  if (key.startsWith('$')) {
    return compileOperator(key, obj[key], registry);
  }

  throw new PredicateError(
    'FORMR_EXPR_PARSE_INVALID_ROOT',
    `Object key "${key}" is not a recognized operator or $path`,
  );
}

function compilePath(value: unknown): ExprNode {
  if (typeof value !== 'string') {
    throw new PredicateError(
      'FORMR_EXPR_PARSE_INVALID_PATH',
      `$path value must be a string, got ${typeof value}`,
    );
  }
  return { kind: 'path', path: value };
}

function compileOperator(
  op: string,
  rawArgs: unknown,
  registry: OperatorRegistry,
): ExprNode {
  const definition = registry.get(op);
  if (!definition) {
    throw new PredicateError(
      'FORMR_EXPR_PARSE_UNKNOWN_OPERATOR',
      `Unknown operator: ${op}`,
    );
  }

  if (!Array.isArray(rawArgs)) {
    throw new PredicateError(
      'FORMR_EXPR_PARSE_INVALID_ARGUMENTS',
      `Operator ${op} arguments must be an array`,
    );
  }

  validateArity(op, rawArgs.length, definition.arity, definition.minArgs);

  const args = rawArgs.map((arg: unknown) => compileNode(arg, registry));
  return { kind: 'op', op, args };
}

function validateArity(
  op: string,
  actual: number,
  arity: number | 'variadic',
  minArgs?: number,
): void {
  if (arity === 'variadic') {
    const min = minArgs ?? 0;
    if (actual < min) {
      throw new PredicateError(
        'FORMR_EXPR_PARSE_INVALID_ARGUMENTS',
        `Operator ${op} requires at least ${String(min)} argument(s), got ${String(actual)}`,
      );
    }
    return;
  }

  if (actual !== arity) {
    throw new PredicateError(
      'FORMR_EXPR_PARSE_INVALID_ARGUMENTS',
      `Operator ${op} requires exactly ${String(arity)} argument(s), got ${String(actual)}`,
    );
  }
}
