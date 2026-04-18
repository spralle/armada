// ADR section 10 — Three transform phases

export type TransformPhase = 'ingress' | 'field' | 'egress';

export interface TransformDefinition {
  readonly id: string;
  readonly phase: TransformPhase;
  readonly path?: string;
  transform(value: unknown, context: TransformContext): unknown;
}

export interface TransformContext {
  readonly phase: TransformPhase;
  readonly path?: string;
  readonly state: unknown;
}

/** Run transforms for a specific phase, optionally filtered by path. */
export function runTransforms(
  transforms: readonly TransformDefinition[],
  phase: TransformPhase,
  value: unknown,
  context: Omit<TransformContext, 'phase'>,
): unknown {
  let result = value;
  for (const t of transforms) {
    if (t.phase !== phase) continue;
    if (t.path && t.path !== context.path) continue;
    result = t.transform(result, { ...context, phase });
  }
  return result;
}

/** Built-in: Date objects → ISO string for canonical storage. */
export function createDateTransform(): TransformDefinition {
  return {
    id: 'formr:date-transform',
    phase: 'field',
    transform(value: unknown): unknown {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    },
  };
}

/** Built-in: ISO date strings pass through unchanged in egress. */
export function createDateEgressTransform(): TransformDefinition {
  return {
    id: 'formr:date-egress-transform',
    phase: 'egress',
    transform(value: unknown): unknown {
      return value;
    },
  };
}
