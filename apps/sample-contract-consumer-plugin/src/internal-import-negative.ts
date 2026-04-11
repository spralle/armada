// @ts-expect-error contract consumer plugins must not import SDK internals
import type { __internalOnly } from "@ghost/plugin-contracts/internal";

void (0 as unknown as typeof __internalOnly);
