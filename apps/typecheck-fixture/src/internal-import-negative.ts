// @ts-expect-error @ghost-shell/contracts must not expose internal paths
import type { __internalOnly } from "@ghost-shell/contracts/internal";

void (0 as unknown as typeof __internalOnly);
