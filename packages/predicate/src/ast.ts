// ADR section 5.2 — Expression AST contract
export type ExprNode =
  | { readonly kind: 'literal'; readonly value: string | number | boolean | null }
  | { readonly kind: 'path'; readonly path: string }
  | { readonly kind: 'op'; readonly op: string; readonly args: readonly ExprNode[] };

export interface ExpressionDefinition {
  readonly id: string;
  readonly ast: ExprNode;
}

export interface RuleDefinition {
  readonly id: string;
  readonly when: ExprNode;
  readonly writes: readonly RuleWrite[];
}

export interface RuleWrite {
  readonly path: string;
  readonly value: ExprNode;
  readonly mode: 'set' | 'delete';
}
