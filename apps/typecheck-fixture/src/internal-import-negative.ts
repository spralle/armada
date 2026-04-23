// @ts-expect-error @ghost-shell/contracts must not expose internal paths
import type { PartRenderer } from "@ghost-shell/contracts/part-renderer";

void (0 as unknown as typeof PartRenderer);
