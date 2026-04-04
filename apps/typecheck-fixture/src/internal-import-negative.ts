// @ts-expect-error @armada/plugin-contracts must not expose internal paths
import type { __internalOnly } from "@armada/plugin-contracts/internal";

void (0 as unknown as typeof __internalOnly);
