/** Type guard: is the value a non-null object (Record-like)? */
export function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object";
}
