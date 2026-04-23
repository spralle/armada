// @ts-expect-error contract consumer plugins must not import SDK internals
import type { __internalOnly } from "@ghost-shell/contracts/internal";

void (0 as unknown as typeof __internalOnly);
