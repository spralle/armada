// ADR section 5.2 — Expression AST contract
export type ExprNode =
  | { readonly kind: 'literal'; readonly value: string | number | boolean | null }
  | { readonly kind: 'path'; readonly path: string }
  | { readonly kind: 'op'; readonly op: string; readonly args: readonly ExprNode[] };

export interface ExpressionDefinition {
  readonly id: string;
  readonly ast: ExprNode;
}

/** Flat scope record for expression evaluation.
 *  Data fields live at top level; namespaces like $ui/$meta are regular keys. */
export type EvaluationScope = Readonly<Record<string, unknown>>;
