/**
 * @typedef {Record<string, unknown>} Predicate
 */

/**
 * @typedef {object} ActionRuntime
 * @property {(menuId: string, context: Record<string, unknown>) => Array<{ actionId: string; title: string; handler: string }>} getMenuActions
 * @property {(key: string, context: Record<string, unknown>) => { invoked: true; actionId: string; handler: string } | { invoked: false; reason: "NO_MATCH" }} dispatchKeybinding
 * @property {(actionId: string, context: Record<string, unknown>) => { invoked: true; actionId: string; handler: string } | { invoked: false; reason: "NOT_FOUND" | "PREDICATE_BLOCKED" }} dispatchAction
 */

/**
 * @param {Array<{
 *   id: string;
 *   title: string;
 *   handler: string;
 *   when?: Predicate;
 *   menu?: Array<{ id: string; when?: Predicate }>;
 *   keybindings?: Array<{ key: string; when?: Predicate }>;
 * }>} actions
 * @returns {ActionRuntime}
 */
export function createActionRuntime(actions) {
  return {
    getMenuActions(menuId, context) {
      return actions
        .filter((action) => matchesPredicate(action.when, context))
        .filter((action) =>
          (action.menu ?? []).some(
            (entry) => entry.id === menuId && matchesPredicate(entry.when, context),
          ),
        )
        .map((action) => ({
          actionId: action.id,
          title: action.title,
          handler: action.handler,
        }));
    },

    dispatchKeybinding(key, context) {
      for (const action of actions) {
        if (!matchesPredicate(action.when, context)) {
          continue;
        }

        const hasKeybinding = (action.keybindings ?? []).some(
          (binding) =>
            binding.key === key && matchesPredicate(binding.when, context),
        );
        if (!hasKeybinding) {
          continue;
        }

        return {
          invoked: true,
          actionId: action.id,
          handler: action.handler,
        };
      }

      return {
        invoked: false,
        reason: "NO_MATCH",
      };
    },

    dispatchAction(actionId, context) {
      const action = actions.find((entry) => entry.id === actionId);
      if (!action) {
        return {
          invoked: false,
          reason: "NOT_FOUND",
        };
      }

      if (!matchesPredicate(action.when, context)) {
        return {
          invoked: false,
          reason: "PREDICATE_BLOCKED",
        };
      }

      return {
        invoked: true,
        actionId: action.id,
        handler: action.handler,
      };
    },
  };
}

/**
 * @param {Predicate | undefined} predicate
 * @param {unknown} context
 * @returns {boolean}
 */
function matchesPredicate(predicate, context) {
  if (!predicate) {
    return true;
  }

  if (!isPlainObject(context)) {
    return false;
  }

  for (const [key, expected] of Object.entries(predicate)) {
    const actual = context[key];

    if (isOperatorObject(expected)) {
      if (!matchesOperatorExpression(actual, expected)) {
        return false;
      }
      continue;
    }

    if (isPlainObject(expected)) {
      if (!matchesPredicate(expected, actual)) {
        return false;
      }
      continue;
    }

    if (actual !== expected) {
      return false;
    }
  }

  return true;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isOperatorObject(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  return Object.keys(value).some((key) => key.startsWith("$"));
}

/**
 * @param {unknown} actual
 * @param {Record<string, unknown>} expression
 * @returns {boolean}
 */
function matchesOperatorExpression(actual, expression) {
  for (const [operator, expected] of Object.entries(expression)) {
    switch (operator) {
      case "$eq":
        if (actual !== expected) {
          return false;
        }
        break;
      case "$ne":
        if (actual === expected) {
          return false;
        }
        break;
      case "$gt":
        if (!(typeof actual === "number" && typeof expected === "number" && actual > expected)) {
          return false;
        }
        break;
      case "$gte":
        if (!(typeof actual === "number" && typeof expected === "number" && actual >= expected)) {
          return false;
        }
        break;
      case "$lt":
        if (!(typeof actual === "number" && typeof expected === "number" && actual < expected)) {
          return false;
        }
        break;
      case "$lte":
        if (!(typeof actual === "number" && typeof expected === "number" && actual <= expected)) {
          return false;
        }
        break;
      case "$in":
        if (!Array.isArray(expected) || !expected.includes(actual)) {
          return false;
        }
        break;
      default:
        return false;
    }
  }

  return true;
}
