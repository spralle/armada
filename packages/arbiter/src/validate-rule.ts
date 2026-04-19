import type { ProductionRule, ThenAction } from './contracts.js';
import { ArbiterError, ArbiterErrorCode } from './errors.js';
import { validatePath } from './path-utils.js';

export type ValidationLevel = 'strict' | 'syntax' | 'none';

const QUERY_OPERATORS = new Set([
  '$gt', '$gte', '$lt', '$lte', '$eq', '$ne', '$in', '$nin',
  '$exists', '$regex', '$not', '$type', '$mod', '$all',
  '$elemMatch', '$size',
]);

const LOGICAL_OPERATORS = new Set(['$and', '$or', '$nor']);

const DANGEROUS_EXPR_PATTERNS = ['$__proto__', '$constructor', '$prototype'];

/**
 * Validate a rule before compilation. Throws ArbiterError on validation failure.
 */
export function validateRule(
  rule: ProductionRule,
  level: ValidationLevel = 'strict',
): void {
  if (level === 'none') return;

  validateSyntax(rule);

  if (level === 'strict') {
    validateStrict(rule);
  }
}

function validateSyntax(rule: ProductionRule): void {
  if (!rule.name || typeof rule.name !== 'string') {
    throw new ArbiterError(
      ArbiterErrorCode.RULE_COMPILATION_FAILED,
      'Rule must have a non-empty name',
    );
  }

  if (!rule.when || typeof rule.when !== 'object') {
    throw new ArbiterError(
      ArbiterErrorCode.RULE_COMPILATION_FAILED,
      `Rule "${rule.name}" must have a "when" clause`,
      { ruleName: rule.name },
    );
  }

  if (!rule.then || rule.then.length === 0) {
    throw new ArbiterError(
      ArbiterErrorCode.RULE_COMPILATION_FAILED,
      `Rule "${rule.name}" must have at least one "then" action`,
      { ruleName: rule.name },
    );
  }

  validateActionPaths(rule.then, rule.name, 'then');
}

function validateStrict(rule: ProductionRule): void {
  walkWhenClause(rule.when, rule.name);
  validateActionPaths(rule.then, rule.name, 'then');

  if (rule.else) {
    validateActionPaths(rule.else, rule.name, 'else');
  }

  if (rule.salience !== undefined && !Number.isFinite(rule.salience)) {
    throw new ArbiterError(
      ArbiterErrorCode.RULE_COMPILATION_FAILED,
      `Rule "${rule.name}" has non-finite salience: ${rule.salience}`,
      { ruleName: rule.name },
    );
  }

  if (rule.activationGroup !== undefined) {
    if (typeof rule.activationGroup !== 'string' || rule.activationGroup.length === 0) {
      throw new ArbiterError(
        ArbiterErrorCode.RULE_COMPILATION_FAILED,
        `Rule "${rule.name}" has invalid activationGroup`,
        { ruleName: rule.name },
      );
    }
  }

  if (rule.onConflict !== undefined) {
    const valid = new Set(['override', 'warn', 'error']);
    if (!valid.has(rule.onConflict)) {
      throw new ArbiterError(
        ArbiterErrorCode.RULE_COMPILATION_FAILED,
        `Rule "${rule.name}" has invalid onConflict: ${String(rule.onConflict)}`,
        { ruleName: rule.name },
      );
    }
  }

  validateExpressionValues(rule.then, rule.name, 'then');
  if (rule.else) {
    validateExpressionValues(rule.else, rule.name, 'else');
  }
}

function validateActionPaths(
  actions: readonly ThenAction[],
  ruleName: string,
  clause: string,
): void {
  for (const action of actions) {
    if ('path' in action && action.path !== undefined) {
      try {
        validatePath(action.path);
      } catch (err) {
        throw new ArbiterError(
          ArbiterErrorCode.PROTOTYPE_POLLUTION,
          `Rule "${ruleName}" ${clause} action has dangerous path: "${action.path}"`,
          err instanceof Error ? { ruleName, cause: err } : { ruleName },
        );
      }
    }
  }
}

function walkWhenClause(obj: Record<string, unknown>, ruleName: string): void {
  for (const key of Object.keys(obj)) {
    if (LOGICAL_OPERATORS.has(key)) {
      const arr = obj[key];
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            walkWhenClause(item as Record<string, unknown>, ruleName);
          }
        }
      }
      continue;
    }

    if (QUERY_OPERATORS.has(key)) {
      continue;
    }

    // Non-operator key is a field path
    if (!key.startsWith('$')) {
      try {
        validatePath(key);
      } catch (err) {
        throw new ArbiterError(
          ArbiterErrorCode.PROTOTYPE_POLLUTION,
          `Rule "${ruleName}" when clause has dangerous path: "${key}"`,
           err instanceof Error ? { ruleName, cause: err } : { ruleName },
        );
      }
    }

    // Recurse into nested objects (operator expressions)
    const val = obj[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      walkWhenClause(val as Record<string, unknown>, ruleName);
    }
  }
}

function validateExpressionValues(
  actions: readonly ThenAction[],
  ruleName: string,
  clause: string,
): void {
  for (const action of actions) {
    if ('value' in action && action.value !== undefined) {
      checkValueForDangerousRefs(action.value, ruleName, clause);
    }
  }
}

function checkValueForDangerousRefs(
  value: unknown,
  ruleName: string,
  clause: string,
): void {
  if (value === null || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    for (const item of value) {
      checkValueForDangerousRefs(item, ruleName, clause);
    }
    return;
  }

  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (DANGEROUS_EXPR_PATTERNS.includes(key)) {
      throw new ArbiterError(
        ArbiterErrorCode.PROTOTYPE_POLLUTION,
        `Rule "${ruleName}" ${clause} expression references dangerous global: "${key}"`,
        { ruleName },
      );
    }
    checkValueForDangerousRefs(obj[key], ruleName, clause);
  }
}
