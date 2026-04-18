import type { StagePolicy, StageTransitionRule } from './state.js';
import { FormrError } from './errors.js';

/** Default profile stages */
export type DefaultStages = 'draft' | 'submit' | 'approve';

/** Default stage policy — ADR section 2.2 */
export function createDefaultStagePolicy(): StagePolicy<DefaultStages> {
  const orderedStages: readonly DefaultStages[] = ['draft', 'submit', 'approve'];
  const transitions: ReadonlyMap<string, StageTransitionRule<DefaultStages>> = new Map([
    ['draft->submit', { from: 'draft', to: 'submit' }],
    ['submit->approve', { from: 'submit', to: 'approve' }],
    ['submit->draft', { from: 'submit', to: 'draft', reason: 'Return to draft' }],
    ['approve->submit', { from: 'approve', to: 'submit', reason: 'Reopen for review' }],
  ]);

  return {
    orderedStages,
    defaultStage: 'draft',
    isKnownStage(stage: string): stage is DefaultStages {
      return orderedStages.includes(stage as DefaultStages);
    },
    canTransition(from: DefaultStages, to: DefaultStages): boolean {
      return transitions.has(`${from}->${to}`);
    },
    describeTransition(from: DefaultStages, to: DefaultStages): StageTransitionRule<DefaultStages> | null {
      return transitions.get(`${from}->${to}`) ?? null;
    },
  };
}

/** Generic stage policy factory */
export function createStagePolicy<S extends string>(config: {
  orderedStages: readonly S[];
  defaultStage: S;
  transitions: readonly { from: S; to: S; reason?: string }[];
}): StagePolicy<S> {
  const transitionMap = new Map<string, StageTransitionRule<S>>();
  for (const t of config.transitions) {
    const rule: StageTransitionRule<S> = t.reason !== undefined
      ? { from: t.from, to: t.to, reason: t.reason }
      : { from: t.from, to: t.to };
    transitionMap.set(`${t.from}->${t.to}`, rule);
  }

  return {
    orderedStages: config.orderedStages,
    defaultStage: config.defaultStage,
    isKnownStage(stage: string): stage is S {
      return config.orderedStages.includes(stage as S);
    },
    canTransition(from: S, to: S): boolean {
      return transitionMap.has(`${from}->${to}`);
    },
    describeTransition(from: S, to: S): StageTransitionRule<S> | null {
      return transitionMap.get(`${from}->${to}`) ?? null;
    },
  };
}

/** Validate that a stage is known — throws FORMR_STAGE_UNKNOWN if not */
export function assertKnownStage<S extends string>(
  policy: StagePolicy<S>,
  stage: string,
): asserts stage is S {
  if (!policy.isKnownStage(stage)) {
    throw new FormrError(
      'FORMR_STAGE_UNKNOWN',
      `Unknown stage: "${stage}". Known stages: ${policy.orderedStages.join(', ')}`,
    );
  }
}
