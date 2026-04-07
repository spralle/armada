import {
  readShellMigrationFlags,
  shouldUseContractComposition,
} from "./migration-flags.js";

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

test("migration flags default to baseline path", () => {
  const flags = readShellMigrationFlags(new URLSearchParams(), null);
  assertEqual(flags.useContractCoreApi, false, "default contract-core flag should be disabled");
  assertEqual(flags.useAdapterComposition, false, "default adapter-composition flag should be disabled");
  assertEqual(shouldUseContractComposition(flags), false, "default composition mode should remain baseline");
});

test("migration flags require both core and adapter flags", () => {
  const coreOnly = readShellMigrationFlags(new URLSearchParams("shellCoreContract=true"), null);
  const adapterOnly = readShellMigrationFlags(new URLSearchParams("shellAdapterComposition=true"), null);
  const both = readShellMigrationFlags(
    new URLSearchParams("shellCoreContract=true&shellAdapterComposition=1"),
    null,
  );

  assertEqual(shouldUseContractComposition(coreOnly), false, "core-only should not enable contract path");
  assertEqual(shouldUseContractComposition(adapterOnly), false, "adapter-only should not enable contract path");
  assertEqual(shouldUseContractComposition(both), true, "both flags should enable contract path");
});

test("migration flags honor explicit window override", () => {
  const flags = readShellMigrationFlags(
    new URLSearchParams(),
    {
      useContractCoreApi: true,
      useAdapterComposition: true,
    },
  );

  assertEqual(flags.useContractCoreApi, true, "override should set contract-core flag");
  assertEqual(flags.useAdapterComposition, true, "override should set adapter-composition flag");
  assertEqual(shouldUseContractComposition(flags), true, "override should enable contract composition");
});

let passed = 0;
for (const caseItem of tests) {
  try {
    caseItem.run();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`migration-flags spec failed: ${caseItem.name} :: ${message}`);
  }
}

console.log(`migration-flags specs passed (${passed}/${tests.length})`);
