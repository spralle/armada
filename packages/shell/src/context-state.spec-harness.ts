export type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

export interface SpecHarness {
  test: (name: string, run: () => void | Promise<void>) => void;
  assertEqual: (actual: unknown, expected: unknown, message: string) => void;
  assertTruthy: (value: unknown, message: string) => void;
}

export class MemoryStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) ?? null) : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

export function createSpecHarness(): {
  harness: SpecHarness;
  runAll: () => Promise<{ passed: number; total: number }>;
} {
  const tests: TestCase[] = [];

  const harness: SpecHarness = {
    test(name, run) {
      tests.push({ name, run });
    },
    assertEqual(actual, expected, message) {
      if (actual !== expected) {
        throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`);
      }
    },
    assertTruthy(value, message) {
      if (!value) {
        throw new Error(message);
      }
    },
  };

  async function runAll(): Promise<{ passed: number; total: number }> {
    let passed = 0;
    for (const caseItem of tests) {
      try {
        await caseItem.run();
        passed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`context-state spec failed: ${caseItem.name} :: ${message}`);
      }
    }

    return {
      passed,
      total: tests.length,
    };
  }

  return {
    harness,
    runAll,
  };
}
