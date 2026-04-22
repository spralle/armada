/** Metadata describing an operator's name and arity. */
export interface OperatorDefinition {
  readonly name: string;
  readonly arity: number | 'variadic';
  readonly minArgs?: number;
}

/** Function signature for custom operator implementations. */
export type CustomOperatorFn = (
  args: readonly unknown[],
  scope: Record<string, unknown>,
) => unknown;

/** A custom operator entry pairing its definition with an execution function. */
export interface CustomOperatorEntry {
  readonly definition: OperatorDefinition;
  readonly execute: CustomOperatorFn;
}

const BASELINE_OPERATORS: readonly OperatorDefinition[] = [
  { name: '$eq', arity: 2 },
  { name: '$ne', arity: 2 },
  { name: '$gt', arity: 2 },
  { name: '$gte', arity: 2 },
  { name: '$lt', arity: 2 },
  { name: '$lte', arity: 2 },
  { name: '$and', arity: 'variadic', minArgs: 1 },
  { name: '$or', arity: 'variadic', minArgs: 1 },
  { name: '$not', arity: 1 },
  { name: '$in', arity: 2 },
  { name: '$nin', arity: 2 },
  { name: '$exists', arity: 2 },
] as const;

/** Registry of built-in and custom operators for query compilation. */
export class OperatorRegistry {
  private readonly operators = new Map<string, OperatorDefinition>();
  private readonly customHandlers = new Map<string, CustomOperatorFn>();

  constructor() {
    for (const op of BASELINE_OPERATORS) {
      this.operators.set(op.name, op);
    }
  }

  /** Look up an operator definition by name. */
  get(name: string): OperatorDefinition | undefined {
    return this.operators.get(name);
  }

  /** Check whether an operator is registered. */
  has(name: string): boolean {
    return this.operators.has(name);
  }

  /** Register a new operator definition and optional execution handler. */
  register(definition: OperatorDefinition, execute?: CustomOperatorFn): void {
    this.operators.set(definition.name, definition);
    if (execute) {
      this.customHandlers.set(definition.name, execute);
    }
  }

  /** Retrieve the custom execution handler for an operator, if registered. */
  getHandler(name: string): CustomOperatorFn | undefined {
    return this.customHandlers.get(name);
  }
}
