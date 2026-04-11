import type { QuickPickItem } from "@ghost/plugin-contracts";
import type { SpecHarness } from "../context-state.spec-harness.js";
import {
  createWindowService,
  type WindowServiceDependencies,
} from "./window-service.js";

function createTestDeps(
  overrides: Partial<WindowServiceDependencies> = {},
): WindowServiceDependencies {
  return {
    getWindowId: () => "win-main",
    getIsPopout: () => false,
    getHostWindowId: () => null,
    getPopoutHandles: () => new Map(),
    getSelectedPartId: () => "part-1",
    renderQuickPick: () => {},
    dismissQuickPick: () => {},
    ...overrides,
  };
}

export function registerWindowServiceSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  // ─── windowId / isPopout ───

  test("window-service: windowId returns correct value", () => {
    const { service } = createWindowService(
      createTestDeps({ getWindowId: () => "win-42" }),
    );
    assertEqual(service.windowId, "win-42", "windowId should match deps");
  });

  test("window-service: isPopout returns false for host window", () => {
    const { service } = createWindowService(createTestDeps());
    assertEqual(service.isPopout, false, "isPopout should be false for host");
  });

  test("window-service: isPopout returns true for popout window", () => {
    const { service } = createWindowService(
      createTestDeps({ getIsPopout: () => true }),
    );
    assertEqual(service.isPopout, true, "isPopout should be true for popout");
  });

  // ─── getWindows() ───

  test("window-service: getWindows returns current window when no popouts", () => {
    const { service } = createWindowService(createTestDeps());

    const windows = service.getWindows();
    assertEqual(windows.length, 1, "should return exactly 1 window");
    assertEqual(windows[0].windowId, "win-main", "windowId should match");
    assertEqual(windows[0].isPopout, false, "isPopout should be false");
    assertEqual(windows[0].hostWindowId, null, "hostWindowId should be null");
    assertEqual(windows[0].activePartId, "part-1", "activePartId should match");
  });

  test("window-service: getWindows returns current window plus popouts", () => {
    const popouts = new Map<string, Window>();
    // Use minimal Window-like objects for test purposes
    popouts.set("win-pop-1", {} as Window);
    popouts.set("win-pop-2", {} as Window);

    const { service } = createWindowService(
      createTestDeps({ getPopoutHandles: () => popouts }),
    );

    const windows = service.getWindows();
    assertEqual(windows.length, 3, "should return 3 windows (1 host + 2 popouts)");

    const host = windows.find((w) => w.windowId === "win-main");
    assertTruthy(host, "host window should be present");
    assertEqual(host?.isPopout, false, "host should not be popout");

    const pop1 = windows.find((w) => w.windowId === "win-pop-1");
    assertTruthy(pop1, "popout 1 should be present");
    assertEqual(pop1?.isPopout, true, "popout 1 should be popout");
    assertEqual(pop1?.hostWindowId, "win-main", "popout 1 host should be main");

    const pop2 = windows.find((w) => w.windowId === "win-pop-2");
    assertTruthy(pop2, "popout 2 should be present");
    assertEqual(pop2?.isPopout, true, "popout 2 should be popout");
  });

  // ─── showQuickPick() ───

  test("window-service: showQuickPick resolves with selected item on accept", async () => {
    const items: QuickPickItem[] = [
      { label: "Alpha" },
      { label: "Beta" },
    ];

    const { service } = createWindowService(
      createTestDeps({
        renderQuickPick: (controller) => {
          // Simulate user accepting immediately after show
          setTimeout(() => {
            const ctrl = controller as unknown as { fireAccept(): void };
            ctrl.fireAccept();
          }, 0);
        },
      }),
    );

    const result = await service.showQuickPick(items, {
      placeholder: "Pick one",
    });

    // The first item is active by default after show()
    assertTruthy(result !== undefined, "result should not be undefined");
    assertEqual(result?.label, "Alpha", "should resolve with first (active) item");
  });

  test("window-service: showQuickPick resolves with undefined on hide", async () => {
    const items: QuickPickItem[] = [
      { label: "Alpha" },
      { label: "Beta" },
    ];

    const { service } = createWindowService(
      createTestDeps({
        renderQuickPick: (controller) => {
          // Simulate user pressing Escape
          setTimeout(() => {
            (controller as { hide(): void }).hide();
          }, 0);
        },
      }),
    );

    const result = await service.showQuickPick(items);
    assertEqual(result, undefined, "should resolve with undefined on hide");
  });

  // ─── createQuickPick() ───

  test("window-service: createQuickPick returns a controllable QuickPick", () => {
    const { service } = createWindowService(createTestDeps());

    const qp = service.createQuickPick<QuickPickItem>();
    assertTruthy(qp, "createQuickPick should return an object");

    qp.items = [{ label: "Test" }];
    assertEqual(qp.items.length, 1, "items should be settable");
    assertEqual(qp.items[0].label, "Test", "items should have correct label");

    qp.placeholder = "Type here";
    assertEqual(qp.placeholder, "Type here", "placeholder should be settable");

    qp.show();
    assertEqual(qp.activeItems.length, 1, "should have active item after show");

    let acceptFired = false;
    qp.onDidAccept(() => {
      acceptFired = true;
    });

    // fireAccept is on QuickPickController but the QuickPick<T> interface
    // doesn't expose it — we access it via the full controller type
    (qp as unknown as { fireAccept(): void }).fireAccept();
    assertEqual(acceptFired, true, "onDidAccept should fire");

    qp.dispose();
  });

  // ─── onDidChangeWindows ───

  test("window-service: onDidChangeWindows fires when triggered", () => {
    const result = createWindowService(createTestDeps());

    let fired = 0;
    result.service.onDidChangeWindows(() => {
      fired += 1;
    });

    result.fireWindowsChanged();
    assertEqual(fired, 1, "should fire once");

    result.fireWindowsChanged();
    assertEqual(fired, 2, "should fire on each call");
  });

  test("window-service: dispose clears all listeners", () => {
    const result = createWindowService(createTestDeps());

    let fired = 0;
    result.service.onDidChangeWindows(() => {
      fired += 1;
    });

    result.fireWindowsChanged();
    assertEqual(fired, 1, "should fire before dispose");

    result.dispose();
    result.fireWindowsChanged();
    assertEqual(fired, 1, "should not fire after dispose");
  });
}
