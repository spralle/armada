import type { ThenStage, CompiledStage } from './contracts.js';
import { compile } from '@ghost-shell/predicate/compile';
import { validatePath } from './path-utils.js';
import { ArbiterError, ArbiterErrorCode } from './errors.js';

/**
 * Extracts the single $-prefixed operator key and body from a pipeline stage.
 */
function extractOperator(stage: ThenStage): { readonly operator: string; readonly body: unknown } {
  const keys = Object.keys(stage);
  const opKeys = keys.filter((k) => k.startsWith('$'));
  if (opKeys.length !== 1) {
    throw new ArbiterError(
      ArbiterErrorCode.RULE_COMPILATION_FAILED,
      `Then stage must have exactly one $-prefixed operator, got: ${opKeys.join(', ') || 'none'}`,
    );
  }
  return { operator: opKeys[0], body: stage[opKeys[0]] };
}

/**
 * Compiles a single ThenStage into a CompiledStage.
 */
function compileStage(stage: ThenStage): CompiledStage {
  const { operator, body } = extractOperator(stage);

  if (operator === '$focus') {
    const focusBody = body as Record<string, unknown>;
    const entries = new Map<string, unknown>();
    entries.set('group', focusBody['group']);
    return { operator, entries };
  }

  const fieldMap = body as Record<string, unknown>;
  const entries = new Map<string, unknown>();

  for (const [path, value] of Object.entries(fieldMap)) {
    validatePath(path);
    if (operator === '$pull') {
      entries.set(path, compile(value as Record<string, unknown>));
    } else {
      entries.set(path, value);
    }
  }

  return { operator, entries };
}

/**
 * Compiles an array of ThenStage into CompiledStage[].
 */
export function compileThenActions(stages: readonly ThenStage[]): readonly CompiledStage[] {
  return stages.map(compileStage);
}
