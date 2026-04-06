import {
  clampChooserFocusIndex,
  formatDegradedModeAnnouncement,
  formatSelectionAnnouncement,
  resolveChooserFocusRestoration,
  resolveChooserKeyboardAction,
  resolveDegradedKeyboardInteraction,
  resolveTabLifecycleShortcut,
} from "./keyboard-a11y.js";
import type { SpecHarness } from "./context-state.spec-harness.js";

export function registerKeyboardA11ySpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("chooser keyboard flow resolves focus and execute deterministically", () => {
    assertEqual(clampChooserFocusIndex(-2, 3), 0, "focus index should clamp lower bound");
    assertEqual(clampChooserFocusIndex(9, 3), 2, "focus index should clamp upper bound");

    const down = resolveChooserKeyboardAction("ArrowDown", 0, 3);
    assertEqual(down.kind, "focus", "ArrowDown should move chooser focus");
    if (down.kind === "focus") {
      assertEqual(down.index, 1, "ArrowDown should move to next option");
    }

    const upWrap = resolveChooserKeyboardAction("ArrowUp", 0, 3);
    assertEqual(upWrap.kind, "focus", "ArrowUp should move chooser focus");
    if (upWrap.kind === "focus") {
      assertEqual(upWrap.index, 2, "ArrowUp should wrap to last option");
    }

    const execute = resolveChooserKeyboardAction("Enter", 2, 3);
    assertEqual(execute.kind, "execute", "Enter should execute focused option");
    if (execute.kind === "execute") {
      assertEqual(execute.index, 2, "Enter should execute current focus index");
    }

    const dismiss = resolveChooserKeyboardAction("Escape", 1, 3);
    assertEqual(dismiss.kind, "dismiss", "Escape should dismiss chooser");
  });

  test("chooser completion and dismiss restore trigger focus selector", () => {
    assertEqual(
      resolveChooserFocusRestoration("dismiss", "button[data-action='select-order'][data-order-id='o-1']"),
      "button[data-action='select-order'][data-order-id='o-1']",
      "dismiss should restore caller focus",
    );
    assertEqual(
      resolveChooserFocusRestoration("execute", "button[data-action='select-vessel'][data-vessel-id='v-1']"),
      "button[data-action='select-vessel'][data-vessel-id='v-1']",
      "execute should restore caller focus",
    );
    assertEqual(
      resolveChooserFocusRestoration("focus", "button[data-action='select-order'][data-order-id='o-1']"),
      null,
      "focus movement should not restore",
    );
  });

  test("degraded-mode keyboard interactions are safely blocked or dismissed", () => {
    assertEqual(
      resolveDegradedKeyboardInteraction("Enter", false),
      "block",
      "degraded mode should block Enter when no chooser is open",
    );
    assertEqual(
      resolveDegradedKeyboardInteraction("ArrowDown", true),
      "block",
      "degraded mode should block chooser navigation keys",
    );
    assertEqual(
      resolveDegradedKeyboardInteraction("Escape", true),
      "dismiss-chooser",
      "degraded mode should still allow chooser dismissal via Escape",
    );
    assertEqual(
      resolveDegradedKeyboardInteraction("Tab", false),
      "allow",
      "degraded mode should allow non-mutating navigation keys",
    );
  });

  test("announcement helpers produce explicit context and degraded messages", () => {
    assertEqual(
      formatSelectionAnnouncement({
        selectedPartTitle: "Unplanned Orders",
        selectedEntitySummary: "order:o-1, vessel:v-1",
      }),
      "Context updated. Part Unplanned Orders. Selection priorities order:o-1, vessel:v-1.",
      "selection announcement should include context and priorities",
    );

    assertEqual(
      formatDegradedModeAnnouncement(true, "publish-failed"),
      "Cross-window sync degraded (publish-failed). Window is now read-only.",
      "degraded announcement should include reason",
    );
    assertEqual(
      formatDegradedModeAnnouncement(false, null),
      "Cross-window sync restored. Window is writable again.",
      "recovery announcement should be explicit",
    );
  });

  test("tab lifecycle shortcuts resolve close/reopen without affecting other keys", () => {
    assertEqual(
      resolveTabLifecycleShortcut("ctrl+shift+t"),
      "reopen-closed-tab",
      "Ctrl+Shift+T should reopen recently closed tab",
    );
    assertEqual(
      resolveTabLifecycleShortcut("meta+shift+t"),
      "reopen-closed-tab",
      "Meta+Shift+T should reopen recently closed tab",
    );
    assertEqual(
      resolveTabLifecycleShortcut("ctrl+w"),
      "close-active-tab",
      "Ctrl+W should close active tab",
    );
    assertEqual(
      resolveTabLifecycleShortcut("meta+w"),
      "close-active-tab",
      "Meta+W should close active tab",
    );
    assertEqual(
      resolveTabLifecycleShortcut("ctrl+shift+w"),
      null,
      "unmapped shortcut should not be interpreted as tab lifecycle action",
    );
  });
}
