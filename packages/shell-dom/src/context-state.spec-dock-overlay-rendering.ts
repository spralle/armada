import type { SpecHarness } from "./context-state.spec-harness.js";
import { renderDockDropOverlay } from "./ui/parts-rendering-dock-panel.js";

export function registerDockOverlayRenderingSpecs(harness: SpecHarness): void {
  const { test, assertTruthy } = harness;

  test("dock drop overlay titles guide rearrange and split targets", () => {
    const markup = renderDockDropOverlay("tab-1");

    assertTruthy(
      markup.includes('title="Drop to split left of this panel"'),
      "left drop zone should describe split affordance",
    );
    assertTruthy(
      markup.includes('title="Drop to split right of this panel"'),
      "right drop zone should describe split affordance",
    );
    assertTruthy(
      markup.includes('title="Drop to split above this panel"'),
      "top drop zone should describe split affordance",
    );
    assertTruthy(
      markup.includes('title="Drop to split below this panel"'),
      "bottom drop zone should describe split affordance",
    );
    assertTruthy(
      markup.includes('title="Drop to merge into this tab stack"'),
      "center drop zone should describe merge affordance",
    );
    assertTruthy(
      markup.includes('data-dock-drop-zone="center" data-target-tab-id="tab-1"'),
      "drop zone wiring attributes should remain unchanged",
    );
  });
}
