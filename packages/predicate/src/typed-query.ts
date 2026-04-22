// ---------- Dot-path generation (depth 3 max, explicit unrolling) ----------

/** Extract keys of T that are not arrays (for dot-path recursion into objects). */
type ObjectKeys<T> = {
  [K in keyof T & string]: NonNullable<T[K]> extends readonly unknown[] ? never : K;
}[keyof T & string];

/** Extract keys of T that are arrays. */
type ArrayKeys<T> = {
  [K in keyof T & string]: NonNullable<T[K]> extends readonly unknown[] ? K : never;
}[keyof T & string];

/** True when V is a plain object — excludes arrays, primitives, Date, RegExp, Function. */
type IsPlainObject<V> =
  V extends readonly unknown[] ? false
  : V extends Date ? false
  : V extends RegExp ? false
  : V extends (...args: readonly unknown[]) => unknown ? false
  : V extends object ? true
  : false;

/**
 * Generate all valid dot-paths up to depth 3.
 * Uses explicit unrolling (no recursion) to keep IDE performance safe.
 * Array-of-objects paths are NOT generated — use $elemMatch instead.
 */
export type DotPaths<T> =
  IsPlainObject<T> extends true
    ? {
        [K in keyof T & string]:
          | K
          | (IsPlainObject<NonNullable<T[K]>> extends true
              ? `${K}.${DotPathsD1<NonNullable<T[K]>>}`
              : never);
      }[keyof T & string]
    : string;

type DotPathsD1<T> = {
  [K in keyof T & string]:
    | K
    | (IsPlainObject<NonNullable<T[K]>> extends true
        ? `${K}.${DotPathsD2<NonNullable<T[K]>>}`
        : never);
}[keyof T & string];

type DotPathsD2<T> = keyof T & string;

// ---------- Path value resolution ----------

/** Resolve a dot-path to its value type. */
export type PathValue<T, P extends string> =
  P extends `${infer Head}.${infer Tail}`
    ? Head extends keyof T
      ? NonNullable<T[Head]> extends readonly (infer E)[]
        ? IsPlainObject<E> extends true
          ? PathValue<E, Tail> | undefined
          : unknown
        : IsPlainObject<NonNullable<T[Head]>> extends true
          ? PathValue<NonNullable<T[Head]>, Tail>
          : unknown
      : unknown
    : P extends keyof T
      ? T[P]
      : unknown;

// ---------- Operator conditions per type ----------

/** Comparison operators valid only for ordered types (number | string | Date). */
interface OrderedOps<V> {
  readonly $gt?: V;
  readonly $gte?: V;
  readonly $lt?: V;
  readonly $lte?: V;
}

/** String-only operators. */
interface StringOps {
  readonly $regex?: string | RegExp;
}

/** Array-specific operators. */
interface ArrayOps<E> {
  readonly $all?: readonly E[];
  readonly $size?: number;
  readonly $elemMatch?: E extends Record<string, unknown> ? TypedQuery<E> : never;
}

/** Base operators available for all value types. */
interface BaseOps<V> {
  readonly $eq?: V | null;
  readonly $ne?: V | null;
  readonly $in?: readonly (V | null)[];
  readonly $nin?: readonly (V | null)[];
  readonly $exists?: boolean;
  readonly $not?: FieldCondition<V>;
}

/** Assemble the correct operator set based on the value type V. */
export type FieldCondition<V> =
  V extends readonly (infer E)[]
    ? BaseOps<V | E> & ArrayOps<E> & (E extends string ? StringOps & OrderedOps<E> : E extends number | Date ? OrderedOps<E> : unknown)
    : V extends string
      ? BaseOps<V> & OrderedOps<V> & StringOps
      : V extends number | Date
        ? BaseOps<V> & OrderedOps<V>
        : BaseOps<V>;

// ---------- Top-level query ----------

/** Logical operators for query composition. */
interface LogicalOps<T> {
  readonly $and?: readonly TypedQuery<T>[];
  readonly $or?: readonly TypedQuery<T>[];
  readonly $nor?: readonly TypedQuery<T>[];
  readonly $not?: TypedQuery<T>;
}

/**
 * TypedQuery<T> — Compile-time-validated MongoDB-style query.
 *
 * When T is a concrete type, field names are validated against dot-paths of T,
 * operator names are constrained per field type, and value types are checked.
 *
 * When T is Record<string, unknown> (or unspecified), degrades gracefully to
 * Record<string, unknown> for full backward compatibility.
 */
export type TypedQuery<T> =
  IsPlainObject<T> extends true
    ? (string extends keyof T
        ? Record<string, unknown>  // fallback for wide Record types
        : { [P in DotPaths<T>]?: PathValue<T, P> | FieldCondition<PathValue<T, P>> } & LogicalOps<T>)
    : Record<string, unknown>;
