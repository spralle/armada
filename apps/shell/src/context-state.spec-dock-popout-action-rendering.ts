import type { SpecHarness } from "./context-state.spec-harness.js";
import { renderDockPartPanel } from "./ui/parts-rendering-dock-panel.js";

export function registerDockPopoutActionRenderingSpecs(harness: SpecHarness): void {
  const { test, assertTruthy, assertEqual } = harness;

  test("dock panel rendering includes visible popout action with existing action wiring attributes", () => {
    const markup = renderDockPartPanel(
      {
        instanceId: "tab-1",
        definitionId: "def-1",
        id: "tab-1",
        partDefinitionId: "def-1",
        title: "Sample tab",
        args: {},
        slot: "main",
        pluginId: "plugin.sample",
      },
      true,
    );

    assertTruthy(markup.includes("class=\"part-actions\""), "dock panel should render action container");
    assertTruthy(markup.includes("data-action=\"popout\""), "dock panel should render popout action");
    assertTruthy(markup.includes("data-tab-id=\"tab-1\""), "popout action should expose tab id");
    assertTruthy(markup.includes("data-part-id=\"tab-1\""), "popout action should expose part id");
    assertTruthy(markup.includes(">Pop out</button>"), "popout action should be visibly labeled");
  });

  test("dock panel rendering does not hide popout action when panel is inactive", () => {
    const markup = renderDockPartPanel(
      {
        instanceId: "tab-2",
        definitionId: "def-2",
        id: "tab-2",
        partDefinitionId: "def-2",
        title: "Inactive tab",
        args: {},
        slot: "main",
        pluginId: "plugin.sample",
      },
      false,
    );

    assertTruthy(markup.includes("hidden"), "inactive dock panel should remain hidden by panel semantics");
    assertEqual(markup.includes("data-action=\"popout\""), true, "inactive panel markup should still include popout action");
  });
}
