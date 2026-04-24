import type { ShellRuntime } from "./app/types.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import { createInitialShellContextState, registerTab } from "./context-state.js";
import { toActionContext } from "./shell-runtime/action-context.js";

export function registerActionContextSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("action context exposes instance and definition selection keys", () => {
    let state = createInitialShellContextState({ initialTabId: "instance-a", initialGroupId: "group-main" });
    state = registerTab(state, {
      tabId: "instance-a",
      partDefinitionId: "orders.part",
      groupId: "group-main",
      tabLabel: "Orders",
    });

    const runtime = {
      selectedPartId: "instance-a",
      contextState: state,
    } as unknown as ShellRuntime;

    const context = toActionContext(runtime);
    assertEqual(context["selection.partInstanceId"], "instance-a", "instance key should use selected tab instance id");
    assertEqual(context["selection.partDefinitionId"], "orders.part", "definition key should use tab definition id");
    assertEqual(context["selection.partId"], "orders.part", "legacy partId should fallback to definition id");
  });

  test("action context falls back to selected instance id when tab metadata missing", () => {
    const runtime = {
      selectedPartId: "instance-missing",
      contextState: createInitialShellContextState({ initialTabId: "other-tab", initialGroupId: "group-main" }),
    } as unknown as ShellRuntime;

    const context = toActionContext(runtime);
    assertEqual(
      context["selection.partDefinitionId"],
      "instance-missing",
      "definition key should fallback to selected instance id",
    );
    assertEqual(context["selection.partId"], "instance-missing", "legacy partId should remain available via fallback");
  });
}
