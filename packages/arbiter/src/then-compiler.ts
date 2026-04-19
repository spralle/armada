import type { ThenAction, CompiledAction } from './contracts.js';
import { compileShorthand } from '@ghost/predicate';
import { validatePath, isExpression } from './path-utils.js';

/**
 * Compiles a single ThenAction into a CompiledAction.
 */
function compileAction(action: ThenAction): CompiledAction {
  switch (action.type) {
    case 'set': {
      validatePath(action.path);
      return {
        type: 'set',
        path: action.path,
        compiledValue: action.value,
      };
    }
    case 'unset': {
      validatePath(action.path);
      return {
        type: 'unset',
        path: action.path,
      };
    }
    case 'push': {
      validatePath(action.path);
      return {
        type: 'push',
        path: action.path,
        compiledValue: action.value,
      };
    }
    case 'pull': {
      validatePath(action.path);
      const compiledMatch = compileShorthand(action.match);
      return {
        type: 'pull',
        path: action.path,
        compiledMatch,
      };
    }
    case 'inc': {
      validatePath(action.path);
      return {
        type: 'inc',
        path: action.path,
        compiledValue: action.value,
      };
    }
    case 'merge': {
      validatePath(action.path);
      return {
        type: 'merge',
        path: action.path,
        compiledValue: action.value,
      };
    }
    case 'focus': {
      return {
        type: 'focus',
        group: action.group,
      };
    }
  }
}

/**
 * Compiles an array of ThenAction into CompiledAction[].
 */
export function compileThenActions(actions: readonly ThenAction[]): readonly CompiledAction[] {
  return actions.map(compileAction);
}
