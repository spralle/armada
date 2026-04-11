// @ts-expect-error @ghost/plugin-contracts must not expose internal paths
import type { __internalOnly } from "@ghost/plugin-contracts/internal";

void (0 as unknown as typeof __internalOnly);
