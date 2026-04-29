// ADR section 5.2 — Expression AST contract

/** A node in the predicate expression AST: literal value, path reference, or operator application. */
export type ExprNode =
  | { readonly kind: "literal"; readonly value: string | number | boolean | null | readonly unknown[] }
  | { readonly kind: "path"; readonly path: string }
  | { readonly kind: "op"; readonly op: string; readonly args: readonly ExprNode[] };

/** A named expression definition binding an ID to an AST. */
export interface ExpressionDefinition {
  readonly id: string;
  readonly ast: ExprNode;
}

/** Flat scope record for expression evaluation.
 *  Data fields live at top level; namespaces like $ui/$meta are regular keys. */
export type EvaluationScope = Readonly<Record<string, unknown>>;
