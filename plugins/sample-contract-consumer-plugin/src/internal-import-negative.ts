// @ts-expect-error contract consumer plugins must not import SDK internals
import type { PartRenderer } from "@ghost-shell/contracts/part-renderer";

void (0 as unknown as typeof PartRenderer);
