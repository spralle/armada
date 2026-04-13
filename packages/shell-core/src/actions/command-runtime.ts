export interface CommandRuntimeContext {
  values: Record<string, string | boolean | number | null | undefined>;
}

export interface CommandContract {
  manifest: {
    id: string;
  };
  contributes?: {
    commands?: Array<{
      id: string;
      title: string;
      handler: string;
      keybinding?: string;
      when?: string;
      enablement?: string;
    }>;
  };
}

export interface RuntimeCommand {
  pluginId: string;
  commandId: string;
  title: string;
  handler: string;
  keybinding?: string;
  when?: string;
  enablement?: string;
  visible: boolean;
  enabled: boolean;
}

export function composeRuntimeCommands(
  contracts: CommandContract[],
  context: CommandRuntimeContext,
): RuntimeCommand[] {
  const commands: RuntimeCommand[] = [];

  for (const contract of contracts) {
    const contributions = contract.contributes;
    if (!contributions?.commands) {
      continue;
    }

    for (const command of contributions.commands) {
      const visible = evaluateCondition(command.when, context.values, true);
      const enabled = visible && evaluateCondition(command.enablement, context.values, true);

      commands.push({
        pluginId: contract.manifest.id,
        commandId: command.id,
        title: command.title,
        handler: command.handler,
        keybinding: command.keybinding,
        when: command.when,
        enablement: command.enablement,
        visible,
        enabled,
      });
    }
  }

  return commands;
}

export function executeKeybinding(
  commands: RuntimeCommand[],
  keybinding: string,
  execute: (command: RuntimeCommand) => void,
): boolean {
  const normalized = normalizeKeybinding(keybinding);
  const command = commands.find(
    (item) => item.visible && item.enabled && normalizeKeybinding(item.keybinding) === normalized,
  );
  if (!command) {
    return false;
  }

  execute(command);
  return true;
}

function normalizeKeybinding(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .split("+")
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean)
    .join("+");
}

function evaluateCondition(
  expression: string | undefined,
  values: CommandRuntimeContext["values"],
  fallback: boolean,
): boolean {
  if (!expression) {
    return fallback;
  }

  const trimmed = expression.trim();
  if (!trimmed) {
    return fallback;
  }

  if (trimmed.startsWith("!")) {
    const key = trimmed.slice(1).trim();
    return !truthy(values[key]);
  }

  if (trimmed.includes("==")) {
    const [rawKey, rawValue] = trimmed.split("==", 2);
    const key = rawKey.trim();
    const expected = rawValue.trim().replace(/^['\"]|['\"]$/g, "");
    const actual = values[key];
    return String(actual ?? "") === expected;
  }

  if (trimmed.includes("!=")) {
    const [rawKey, rawValue] = trimmed.split("!=", 2);
    const key = rawKey.trim();
    const expected = rawValue.trim().replace(/^['\"]|['\"]$/g, "");
    const actual = values[key];
    return String(actual ?? "") !== expected;
  }

  return truthy(values[trimmed]);
}

function truthy(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === "false" || normalized === "0" || normalized === "none") {
      return false;
    }

    return true;
  }

  return Boolean(value);
}
