import type { IntentWhenMatcher } from "./contracts.js";

export function createKueryIntentWhenMatcher(): IntentWhenMatcher {
  throw new Error(
    "Kuery intent matcher is intentionally not implemented yet. See docs/architecture/adr-intent-kuery-adapter-boundary.md.",
  );
}
