// ---------------------------------------------------------------------------
// Beta Join Syntax Candidates (ADR §14.3)
// Decision deferred — these are stubs for API design discussion.
// ---------------------------------------------------------------------------

/** Candidate A: MongoDB-style with $fact operator */
export interface BetaJoinCandidateA {
  readonly name: string;
  readonly when: {
    readonly $fact?: {
      readonly type: string;
      readonly match: Record<string, unknown>;
      readonly as?: string;
    };
    readonly [key: string]: unknown;
  };
  readonly then: readonly unknown[];
}

/** Candidate B: Separate facts array */
export interface BetaJoinCandidateB {
  readonly name: string;
  readonly facts?: readonly {
    readonly type: string;
    readonly match: Record<string, unknown>;
    readonly as: string;
  }[];
  readonly when: Record<string, unknown>;
  readonly then: readonly unknown[];
}

/** Candidate C: Drools-style LHS pattern */
export interface BetaJoinCandidateC {
  readonly name: string;
  readonly patterns: readonly {
    readonly type: string;
    readonly bind?: string;
    readonly constraints: Record<string, unknown>;
  }[];
  readonly then: readonly unknown[];
}
