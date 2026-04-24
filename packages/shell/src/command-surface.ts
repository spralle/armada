import type {
  PluginActionContribution,
  PluginContributionPredicate,
  PluginContract,
  PluginKeybindingContribution,
  PluginMenuContribution,
} from "@ghost-shell/contracts";
import type { IntentResolutionDelegate, IntentRuntime } from "@ghost-shell/intents";

export interface ActionSurfaceContext {
  [key: string]: string;
}

export interface RegisteredAction {
  id: string;
  title: string;
  intent: string;
  pluginId: string;
  when?: PluginContributionPredicate | undefined;
  enablement?: PluginContributionPredicate | undefined;
}

export interface RegisteredMenuItem {
  action: string;
  menu: string;
  group?: string | undefined;
  when?: PluginContributionPredicate | undefined;
}

export interface RegisteredKeybinding {
  action: string;
  key: string;
  when?: PluginContributionPredicate | undefined;
}

export interface EvaluatedAction {
  action: RegisteredAction;
  visible: boolean;
  enabled: boolean;
}

export interface ActionDispatchResult {
  executed: boolean;
  actionId: string;
  message: string;
}

export interface ShellActionSurface {
  registerContracts(contracts: readonly PluginContract[]): void;
  evaluateActions(context: Readonly<ActionSurfaceContext>): EvaluatedAction[];
  evaluateMenu(
    menu: string,
    context: Readonly<ActionSurfaceContext>,
  ): EvaluatedAction[];
  dispatchAction(
    actionId: string,
    context: Readonly<ActionSurfaceContext>,
    args?: unknown,
  ): Promise<ActionDispatchResult>;
  dispatchKeybinding(
    key: string,
    context: Readonly<ActionSurfaceContext>,
    args?: unknown,
  ): Promise<ActionDispatchResult> | null;
}

interface RegistryState {
  actions: RegisteredAction[];
  menus: RegisteredMenuItem[];
  keybindings: RegisteredKeybinding[];
}

export function createShellActionSurface(options: {
  intentRuntime: IntentRuntime;
}): ShellActionSurface {
  const state: RegistryState = {
    actions: [],
    menus: [],
    keybindings: [],
  };

  return {
    registerContracts(contracts) {
      state.actions = [];
      state.menus = [];
      state.keybindings = [];

      for (const contract of contracts) {
        const pluginId = contract.manifest.id;
        const contributions = contract.contributes;
        if (!contributions) {
          continue;
        }

        for (const action of contributions.actions ?? []) {
          state.actions.push(toRegisteredAction(action, pluginId));
        }

        for (const menuItem of contributions.menus ?? []) {
          state.menus.push({
            action: menuItem.action,
            menu: menuItem.menu,
            group: menuItem.group,
            when: menuItem.when,
          });
        }

        for (const keybinding of contributions.keybindings ?? []) {
          state.keybindings.push({
            action: keybinding.action,
            key: normalizeKeybinding(keybinding.keybinding),
            when: keybinding.when,
          });
        }
      }
    },
    evaluateActions(context) {
      return state.actions
        .map((action) => evaluateAction(action, context))
        .sort((left, right) => left.action.id.localeCompare(right.action.id));
    },
    evaluateMenu(menu, context) {
      const actionIndex = new Map(state.actions.map((action) => [action.id, action]));

      const rows = state.menus
        .filter((item) => item.menu === menu)
        .filter((item) => evaluatePredicate(item.when, context))
        .map((item) => {
          const action = actionIndex.get(item.action);
          if (!action) {
            return null;
          }
          return {
            item,
            evaluated: evaluateAction(action, context),
          };
        })
        .filter((row): row is { item: RegisteredMenuItem; evaluated: EvaluatedAction } =>
          row !== null,
        );

      rows.sort((left, right) => {
        const leftGroup = left.item.group ?? "";
        const rightGroup = right.item.group ?? "";
        const groupCompare = leftGroup.localeCompare(rightGroup);
        if (groupCompare !== 0) {
          return groupCompare;
        }

        return left.evaluated.action.id.localeCompare(right.evaluated.action.id);
      });

      return rows.map((row) => row.evaluated);
    },
    async dispatchAction(actionId, context, args) {
      const action = state.actions.find((item) => item.id === actionId);
      if (!action) {
        return {
          executed: false,
          actionId,
          message: `Unknown action '${actionId}'.`,
        };
      }

      const evaluation = evaluateAction(action, context);
      if (!evaluation.visible) {
        return {
          executed: false,
          actionId,
          message: `Action '${actionId}' is not visible in current context.`,
        };
      }
      if (!evaluation.enabled) {
        return {
          executed: false,
          actionId,
          message: `Action '${actionId}' is disabled in current context.`,
        };
      }

      const noopDelegate: IntentResolutionDelegate = {
        async showChooser() { return null; },
        async activatePlugin() { return true; },
        announce() {},
      };

      const outcome = await options.intentRuntime.resolve(
        { type: action.intent, facts: context as Record<string, unknown> },
        noopDelegate,
      );

      return {
        executed: outcome.kind === "executed",
        actionId,
        message: outcome.kind === "executed"
          ? `Executed '${actionId}'.`
          : outcome.kind === "no-match"
            ? (outcome as { feedback: string }).feedback
            : `Action '${actionId}' cancelled.`,
      };
    },
    dispatchKeybinding(key, context, args) {
      const normalized = normalizeKeybinding(key);
      const match = state.keybindings
        .filter((binding) => binding.key === normalized)
        .find((binding) => evaluatePredicate(binding.when, context));
      if (!match) {
        return null;
      }

      return this.dispatchAction(match.action, context, args);
    },
  };
}

function toRegisteredAction(
  contribution: PluginActionContribution,
  pluginId: string,
): RegisteredAction {
  return {
    id: contribution.id,
    title: contribution.title,
    intent: contribution.intent,
    pluginId,
    when: contribution.when,
    enablement: contribution.when,
  };
}

function evaluateAction(
  action: RegisteredAction,
  context: Readonly<ActionSurfaceContext>,
): EvaluatedAction {
  const visible = evaluatePredicate(action.when, context);
  const enabled = visible && evaluatePredicate(action.enablement, context);

  return {
    action,
    visible,
    enabled,
  };
}

export function evaluatePredicate(
  predicate: PluginContributionPredicate | undefined,
  context: Readonly<ActionSurfaceContext>,
): boolean {
  if (!predicate) {
    return true;
  }

  for (const [key, value] of Object.entries(predicate)) {
    if ((context[key] ?? "") !== String(value ?? "")) {
      return false;
    }
  }

  return true;
}

function normalizeKeybinding(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .split("+")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join("+");
}

export type {
  PluginKeybindingContribution,
  PluginMenuContribution,
};
