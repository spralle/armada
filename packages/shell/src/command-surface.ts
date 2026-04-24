import type {
  PluginActionContribution,
  PluginContributionPredicate,
  PluginContract,
  PluginKeybindingContribution,
  PluginMenuContribution,
} from "@ghost-shell/contracts";
import type { IntentResolutionDelegate, IntentRuntime } from "@ghost-shell/intents";

export interface CommandSurfaceContext {
  [key: string]: string;
}

export interface RegisteredCommand {
  id: string;
  title: string;
  intent: string;
  pluginId: string;
  when?: PluginContributionPredicate | undefined;
  enablement?: PluginContributionPredicate | undefined;
}

export interface RegisteredMenuItem {
  command: string;
  menu: string;
  group?: string | undefined;
  when?: PluginContributionPredicate | undefined;
}

export interface RegisteredKeybinding {
  command: string;
  key: string;
  when?: PluginContributionPredicate | undefined;
}

export interface EvaluatedCommand {
  command: RegisteredCommand;
  visible: boolean;
  enabled: boolean;
}

export interface CommandDispatchResult {
  executed: boolean;
  commandId: string;
  message: string;
}

export interface ShellCommandSurface {
  registerContracts(contracts: readonly PluginContract[]): void;
  evaluateCommands(context: Readonly<CommandSurfaceContext>): EvaluatedCommand[];
  evaluateMenu(
    menu: string,
    context: Readonly<CommandSurfaceContext>,
  ): EvaluatedCommand[];
  dispatchCommand(
    commandId: string,
    context: Readonly<CommandSurfaceContext>,
    args?: unknown,
  ): Promise<CommandDispatchResult>;
  dispatchKeybinding(
    key: string,
    context: Readonly<CommandSurfaceContext>,
    args?: unknown,
  ): Promise<CommandDispatchResult> | null;
}

interface RegistryState {
  commands: RegisteredCommand[];
  menus: RegisteredMenuItem[];
  keybindings: RegisteredKeybinding[];
}

export function createShellCommandSurface(options: {
  intentRuntime: IntentRuntime;
}): ShellCommandSurface {
  const state: RegistryState = {
    commands: [],
    menus: [],
    keybindings: [],
  };

  return {
    registerContracts(contracts) {
      state.commands = [];
      state.menus = [];
      state.keybindings = [];

      for (const contract of contracts) {
        const pluginId = contract.manifest.id;
        const contributions = contract.contributes;
        if (!contributions) {
          continue;
        }

        for (const command of contributions.actions ?? []) {
          state.commands.push(toRegisteredCommand(command, pluginId));
        }

        for (const menuItem of contributions.menus ?? []) {
          state.menus.push({
            command: menuItem.action,
            menu: menuItem.menu,
            group: menuItem.group,
            when: menuItem.when,
          });
        }

        for (const keybinding of contributions.keybindings ?? []) {
          state.keybindings.push({
            command: keybinding.action,
            key: normalizeKeybinding(keybinding.keybinding),
            when: keybinding.when,
          });
        }
      }
    },
    evaluateCommands(context) {
      return state.commands
        .map((command) => evaluateCommand(command, context))
        .sort((left, right) => left.command.id.localeCompare(right.command.id));
    },
    evaluateMenu(menu, context) {
      const commandIndex = new Map(state.commands.map((command) => [command.id, command]));

      const rows = state.menus
        .filter((item) => item.menu === menu)
        .filter((item) => evaluatePredicate(item.when, context))
        .map((item) => {
          const command = commandIndex.get(item.command);
          if (!command) {
            return null;
          }
          return {
            item,
            evaluated: evaluateCommand(command, context),
          };
        })
        .filter((row): row is { item: RegisteredMenuItem; evaluated: EvaluatedCommand } =>
          row !== null,
        );

      rows.sort((left, right) => {
        const leftGroup = left.item.group ?? "";
        const rightGroup = right.item.group ?? "";
        const groupCompare = leftGroup.localeCompare(rightGroup);
        if (groupCompare !== 0) {
          return groupCompare;
        }

        return left.evaluated.command.id.localeCompare(right.evaluated.command.id);
      });

      return rows.map((row) => row.evaluated);
    },
    async dispatchCommand(commandId, context, args) {
      const command = state.commands.find((item) => item.id === commandId);
      if (!command) {
        return {
          executed: false,
          commandId,
          message: `Unknown command '${commandId}'.`,
        };
      }

      const evaluation = evaluateCommand(command, context);
      if (!evaluation.visible) {
        return {
          executed: false,
          commandId,
          message: `Command '${commandId}' is not visible in current context.`,
        };
      }
      if (!evaluation.enabled) {
        return {
          executed: false,
          commandId,
          message: `Command '${commandId}' is disabled in current context.`,
        };
      }

      const noopDelegate: IntentResolutionDelegate = {
        async showChooser() { return null; },
        async activatePlugin() { return true; },
        announce() {},
      };

      const outcome = await options.intentRuntime.resolve(
        { type: command.intent, facts: context as Record<string, unknown> },
        noopDelegate,
      );

      return {
        executed: outcome.kind === "executed",
        commandId,
        message: outcome.kind === "executed"
          ? `Executed '${commandId}'.`
          : outcome.kind === "no-match"
            ? (outcome as { feedback: string }).feedback
            : `Command '${commandId}' cancelled.`,
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

      return this.dispatchCommand(match.command, context, args);
    },
  };
}

function toRegisteredCommand(
  contribution: PluginActionContribution,
  pluginId: string,
): RegisteredCommand {
  return {
    id: contribution.id,
    title: contribution.title,
    intent: contribution.intent,
    pluginId,
    when: contribution.when,
    enablement: contribution.when,
  };
}

function evaluateCommand(
  command: RegisteredCommand,
  context: Readonly<CommandSurfaceContext>,
): EvaluatedCommand {
  const visible = evaluatePredicate(command.when, context);
  const enabled = visible && evaluatePredicate(command.enablement, context);

  return {
    command,
    visible,
    enabled,
  };
}

export function evaluatePredicate(
  predicate: PluginContributionPredicate | undefined,
  context: Readonly<CommandSurfaceContext>,
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
