import type { ShellRuntime } from "../app/types.js";
import { updateWindowReadOnlyState } from "./context-controls.js";

type TestCase = {
  name: string;
  run: () => void;
};

const tests: TestCase[] = [];

function test(name: string, run: () => void): void {
  tests.push({ name, run });
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`);
  }
}

class FakeControl {
  readonly id: string;
  readonly dataset: DOMStringMap;

  private readonly attrs = new Map<string, string>();

  constructor(input: {
    id?: string;
    action?: string;
  } = {}) {
    this.id = input.id ?? "";
    this.dataset = input.action ? { action: input.action } : {};
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attrs.delete(name);
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }
}

class FakeShellNode {
  readonly classNames = new Set<string>();

  readonly classList = {
    toggle: (className: string, force?: boolean) => {
      if (force === undefined) {
        if (this.classNames.has(className)) {
          this.classNames.delete(className);
        } else {
          this.classNames.add(className);
        }
        return;
      }

      if (force) {
        this.classNames.add(className);
      } else {
        this.classNames.delete(className);
      }
    },
  };

  constructor(private readonly controls: FakeControl[]) {}

  querySelectorAll<T>(_selector: string): T[] {
    return this.controls as unknown as T[];
  }
}

class FakeRoot {
  constructor(private readonly shellNode: FakeShellNode) {}

  querySelector<T>(selector: string): T | null {
    if (selector === "#shell-root") {
      return this.shellNode as unknown as T;
    }
    return null;
  }
}

function createRuntime(overrides: Partial<ShellRuntime> = {}): ShellRuntime {
  return {
    syncDegraded: false,
    syncDegradedReason: null,
    ...overrides,
  } as ShellRuntime;
}

test("publish-failed degraded mode applies read-only styling and mutating control disablement", () => {
  const applyButton = new FakeControl({ id: "context-apply" });
  const input = new FakeControl({ id: "context-value-input" });
  const nonMutating = new FakeControl({ id: "some-other-control" });
  const shellNode = new FakeShellNode([applyButton, input, nonMutating]);
  const root = new FakeRoot(shellNode);

  updateWindowReadOnlyState(root as unknown as HTMLElement, createRuntime({
    syncDegraded: true,
    syncDegradedReason: "publish-failed",
  }));

  assertEqual(shellNode.classNames.has("sync-degraded"), true, "publish-failed should set sync-degraded class");
  assertEqual(applyButton.getAttribute("disabled"), "disabled", "context apply should be disabled when degraded");
  assertEqual(input.getAttribute("disabled"), "disabled", "context input should be disabled when degraded");
  assertEqual(nonMutating.getAttribute("disabled"), null, "non-mutating controls should remain enabled");
});

test("unavailable bridge keeps shell interactive in local-only mode", () => {
  const applyButton = new FakeControl({ id: "context-apply" });
  const input = new FakeControl({ id: "context-value-input" });
  const nonMutating = new FakeControl({ id: "some-other-control" });
  const shellNode = new FakeShellNode([applyButton, input, nonMutating]);
  const root = new FakeRoot(shellNode);

  updateWindowReadOnlyState(root as unknown as HTMLElement, createRuntime({
    syncDegraded: true,
    syncDegradedReason: "unavailable",
  }));

  assertEqual(shellNode.classNames.has("sync-degraded"), false, "unavailable should not set sync-degraded class");
  assertEqual(applyButton.getAttribute("disabled"), null, "context apply should stay enabled when unavailable");
  assertEqual(input.getAttribute("disabled"), null, "context input should stay enabled when unavailable");
  assertEqual(nonMutating.getAttribute("disabled"), null, "other controls should stay enabled when unavailable");
});

let passed = 0;
for (const caseItem of tests) {
  try {
    caseItem.run();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`context-controls spec failed: ${caseItem.name} :: ${message}`);
  }
}

console.log(`context-controls specs passed (${passed}/${tests.length})`);
