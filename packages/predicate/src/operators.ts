export interface OperatorDefinition {
  readonly name: string;
  readonly arity: number | 'variadic';
  readonly minArgs?: number;
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

  register(definition: OperatorDefinition): void {
    this.operators.set(definition.name, definition);
  }
}
