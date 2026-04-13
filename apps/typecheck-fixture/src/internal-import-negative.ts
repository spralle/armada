// @ts-expect-error @ghost-shell/plugin-contracts must not expose internal paths
import type { __internalOnly } from "@ghost-shell/plugin-contracts/internal";

void (0 as unknown as typeof __internalOnly);
