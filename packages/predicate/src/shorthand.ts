import type { ExprNode } from './ast.js';

export type ShorthandQuery = Record<string, unknown>;

const LOGICAL_OPS = new Set(['$and', '$or', '$not']);
const COMPARISON_OPS = new Set(['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$exists', '$regex']);

function isOperatorObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.length > 0 && keys.every((k) => k.startsWith('$'));
}

function makePath(field: string): ExprNode {
  return { kind: 'path', path: field };
}

function makeLiteral(value: unknown): ExprNode {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return { kind: 'literal', value };
  }
  if (Array.isArray(value)) {
    return { kind: 'literal', value: value as unknown as null };
  }
  throw new Error(`Unsupported literal value: ${String(value)}`);
}

function makeLiteralArray(arr: readonly unknown[]): ExprNode {
  // Represent arrays as a literal node; the evaluator handles arrays via $in
  // We store the array directly — the evaluate function reads it as-is from literal nodes
  return { kind: 'literal', value: arr as unknown as null };
}

function compileFieldOperators(field: string, operators: Record<string, unknown>): ExprNode {
  const entries = Object.entries(operators);
  const hasOptions = '$options' in operators;
  const nodes: ExprNode[] = [];

  for (const [op, value] of entries) {
    if (op === '$options') continue;

    if (op === '$elemMatch') {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('$elemMatch requires an object sub-query');
      }
      nodes.push({ kind: 'op', op: '$elemMatch', args: [makePath(field), compileShorthand(value as ShorthandQuery)] });
      continue;
    }

    if (op === '$regex') {
      const regexArgs: ExprNode[] = [makePath(field), makeLiteral(String(value))];
      if (hasOptions) {
        regexArgs.push(makeLiteral(String(operators['$options'])));
      }
      nodes.push({ kind: 'op', op: '$regex', args: regexArgs });
      continue;
    }

    if (!COMPARISON_OPS.has(op)) {
      throw new Error(`Unknown operator: ${op}`);
    }
    if (op === '$in' || op === '$nin') {
      if (!Array.isArray(value)) {
        throw new Error(`${op} requires an array value`);
      }
      nodes.push({ kind: 'op', op, args: [makePath(field), makeLiteralArray(value)] });
      continue;
    }
    if (op === '$exists') {
      nodes.push({ kind: 'op', op: '$exists', args: [makePath(field), makeLiteral(Boolean(value))] });
      continue;
    }
    nodes.push({ kind: 'op', op, args: [makePath(field), makeLiteral(value)] });
  }

  if (nodes.length === 1) return nodes[0];
  return { kind: 'op', op: '$and', args: nodes };
}

function compileFieldEntry(field: string, value: unknown): ExprNode {
  if (value instanceof RegExp) {
    const args: ExprNode[] = [makePath(field), makeLiteral(value.source)];
    if (value.flags) {
      args.push(makeLiteral(value.flags));
    }
    return { kind: 'op', op: '$regex', args };
  }
  if (isOperatorObject(value)) {
    return compileFieldOperators(field, value as Record<string, unknown>);
  }
  return { kind: 'op', op: '$eq', args: [makePath(field), makeLiteral(value)] };
}

function compileLogicalOp(op: string, value: unknown): ExprNode {
  if (op === '$not') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('$not requires an object value');
    }
    return { kind: 'op', op: '$not', args: [compileShorthand(value as ShorthandQuery)] };
  }
  if (!Array.isArray(value)) {
    throw new Error(`${op} requires an array of conditions`);
  }
  const args = (value as unknown[]).map((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`${op} array items must be objects`);
    }
    return compileShorthand(item as ShorthandQuery);
  });
  return { kind: 'op', op, args };
}

/**
 * Compiles a MongoDB-style shorthand query into the predicate AST.
 *
 * Supports field-implicit equality, operator objects, logical combinators,
 * and dot-notation paths.
 */
export function compileShorthand(query: ShorthandQuery): ExprNode {
  const entries = Object.entries(query);

  if (entries.length === 0) {
    return { kind: 'literal', value: true };
  }

  const nodes: ExprNode[] = [];

  for (const [key, value] of entries) {
    if (LOGICAL_OPS.has(key)) {
      nodes.push(compileLogicalOp(key, value));
    } else {
      nodes.push(compileFieldEntry(key, value));
    }
  }

  if (nodes.length === 1) return nodes[0];
  return { kind: 'op', op: '$and', args: nodes };
}
