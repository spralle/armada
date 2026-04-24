# @ghost-shell/predicate

## Purpose

A standalone MongoDB-style production rule engine for evaluating queries against documents. Used throughout Ghost Shell for when-clause evaluation, contribution filtering, and intent matching — but has no Ghost Shell dependencies and can be used independently.

## Installation

```bash
bun add @ghost-shell/predicate
```

## Key Exports

### `Predicate<T>` Class

Compiled query with fluent API for filtering collections:

```ts
class Predicate<T = Record<string, unknown>> {
  constructor(query: TypedQuery<T> | Query, options?: PredicateOptions);
  test(doc: T): boolean;
  find(collection: readonly T[]): readonly T[];
  findOne(collection: readonly T[]): T | undefined;
  skip(count: number): this;
  limit(count: number): this;
  sort(spec: Record<string, 1 | -1>): this;
}

interface PredicateOptions {
  readonly registry?: OperatorRegistry;
}
```

### Compilation

```ts
type Query = Record<string, unknown>;

function compile(query: Query): ExprNode;
function compileFilter(query: Query, options?: CompileFilterOptions): FilterFn;
function compileShorthand(query: ShorthandQuery): Query;

type FilterFn<T = Record<string, unknown>> = (doc: T) => boolean;
```

### Evaluation

```ts
function evaluate(node: ExprNode, scope: EvaluationScope, options?: EvaluateOptions): unknown;

interface EvaluateOptions {
  readonly maxDepth?: number;
  readonly operators?: OperatorRegistry;
}
```

### Diagnostics

```ts
function evaluateWithTrace(
  node: ExprNode,
  scope: EvaluationScope,
): EvaluateWithTraceResult;

interface PredicateFailureTrace {
  path: string;
  operator: string;
  expected: unknown;
  actual: unknown;
}
```

### Collection Helpers

```ts
function find<T>(collection: readonly T[], query: Query, options?: FindOptions): readonly T[];
function findOne<T>(collection: readonly T[], query: Query): T | undefined;
```

### Custom Operators

```ts
class OperatorRegistry {
  register(name: string, definition: OperatorDefinition): void;
  get(name: string): CustomOperatorEntry | undefined;
}

type CustomOperatorFn = (fieldValue: unknown, operatorValue: unknown) => boolean;
```

### Typed Queries

```ts
type TypedQuery<T> = { [K in DotPaths<T>]?: FieldCondition<PathValue<T, K>> };
```

Provides full dot-path autocomplete and type-safe field conditions for known document shapes.

### Path Utilities

```ts
function resolvePath(path: string, doc: Record<string, unknown>): unknown;
function validateAndSplitPath(path: string): string[];
const PATH_MISSING: unique symbol;
```

### Safety

```ts
function assertSafeSegment(segment: string): void;
const DANGEROUS_KEYS: ReadonlySet<string>;

class PredicateError extends Error {
  readonly code: PredicateErrorCode;
}
```

### Supported Operators

`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$exists`, `$regex`, `$all`, `$size`, `$and`, `$or`, `$not`, `$nor`.

## Examples

```ts
import { Predicate, find, compile, evaluateWithTrace } from "@ghost-shell/predicate";

// Fluent API
const pred = new Predicate<User>({ age: { $gte: 18 }, role: "admin" });
const admins = pred.sort({ name: 1 }).limit(10).find(users);

// One-shot find
const results = find(documents, { status: "active", "metadata.priority": { $gte: 2 } });

// Diagnostics
const ast = compile({ score: { $gt: 90 } });
const trace = evaluateWithTrace(ast, { score: 50 });
if (!trace.matched) {
  console.log("Failed:", trace.failures);
}

// Custom operator
import { OperatorRegistry } from "@ghost-shell/predicate";
const registry = new OperatorRegistry();
registry.register("$startsWith", {
  evaluate: (field, value) => typeof field === "string" && field.startsWith(String(value)),
});
const pred2 = new Predicate({ name: { $startsWith: "A" } }, { registry });
```
