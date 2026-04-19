export interface OperatorDefinition {
  readonly name: string;
  readonly arity: number | 'variadic';
  readonly minArgs?: number;
}

export type CustomOperatorFn = (
  args: readonly unknown[],
  scope: Record<string, unknown>,
) => unknown;

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

export class OperatorRegistry {
  private readonly operators = new Map<string, OperatorDefinition>();
  private readonly customHandlers = new Map<string, CustomOperatorFn>();

  constructor() {
    for (const op of BASELINE_OPERATORS) {
      this.operators.set(op.name, op);
    }
  }

  get(name: string): OperatorDefinition | undefined {
    return this.operators.get(name);
  }

  has(name: string): boolean {
    return this.operators.has(name);
  }

  register(definition: OperatorDefinition, execute?: CustomOperatorFn): void {
    this.operators.set(definition.name, definition);
    if (execute) {
      this.customHandlers.set(definition.name, execute);
    }
  }

  getHandler(name: string): CustomOperatorFn | undefined {
    return this.customHandlers.get(name);
  }
}
