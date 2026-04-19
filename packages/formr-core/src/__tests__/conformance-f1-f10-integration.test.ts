import { describe, test, expect, beforeEach } from 'bun:test';
import {
  createForm,
  parsePath,
  toPointer,
  toDot,
  runTransforms,
  createDateTransform,
  createDateEgressTransform,
  applyRuleWrites,
  sortIssues,
  createDefaultStagePolicy,
  validateExtension,
  clearExtensionRegistry,
  isCompatibleVersion,
  STABLE_CAPABILITIES,
  type TransformDefinition,
  type ProductionRule,
  type ExtensionManifest,
} from '../index.js';
import {
  ingestSchema,
  extractFromJsonSchema,
} from '../../../formr-from-schema/src/index.js';
import {
  compile,
  evaluate,
} from '../../../predicate/src/index.js';

describe('F1-F10: Full integration conformance', () => {
  // --- (a) Simple contact form: F1, F2, F6, F7 ---
  describe('(a) Simple contact form — F1 paths, F2 stages, F6 runtime, F7 API', () => {
    test('create form, set values via field API, read state', () => {
      const form = createForm({ initialData: {} });

      // F7: setValue API
      form.setValue('name', 'Alice');
      form.setValue('email', 'alice@example.com');
      form.setValue('phone', '555-1234');

      const state = form.getState();
      const data = state.data as Record<string, unknown>;
      expect(data.name).toBe('Alice');
      expect(data.email).toBe('alice@example.com');
      expect(data.phone).toBe('555-1234');

      // F1: path parsing round-trip
      const parsed = parsePath('name');
      expect(parsed.namespace).toBe('data');
      expect(toPointer(parsed)).toBe('/name');
      expect(toDot(parsed)).toBe('name');

      // F7: field API
      const nameField = form.field('name');
      expect(nameField.get()).toBe('Alice');

      form.dispose();
    });

    test('submit flow succeeds with onSubmit handler', async () => {
      let submittedPayload: unknown = null;
      const form = createForm({
        initialData: { name: 'Bob' },
        onSubmit: async ({ payload }) => {
          submittedPayload = payload;
          return { ok: true, submitId: 'test-submit' };
        },
      });

      const result = await form.submit();
      expect(result.ok).toBe(true);
      expect((submittedPayload as Record<string, unknown>).name).toBe('Bob');

      // F2: stage is tracked in meta
      const state = form.getState();
      expect(state.meta.stage).toBeDefined();

      form.dispose();
    });
  });

  // --- (b) Schema-driven form with validation: F4, F5, F8 ---
  describe('(b) Schema-driven form — F4 ingestion, F5 validation envelope, F8 ordering', () => {
    test('ingest JSON schema and create form from fields', () => {
      const jsonSchema = {
        type: 'object' as const,
        properties: {
          firstName: { type: 'string' as const },
          lastName: { type: 'string' as const },
          age: { type: 'number' as const },
        },
        required: ['firstName', 'lastName'],
      };

      // F4: schema ingestion
      const ingestion = ingestSchema(jsonSchema);
      expect(ingestion.fields.length).toBeGreaterThanOrEqual(3);

      const firstNameField = ingestion.fields.find((f) => f.path === 'firstName');
      expect(firstNameField).toBeDefined();
      expect(firstNameField!.required).toBe(true);
      expect(firstNameField!.type).toBe('string');

      const ageField = ingestion.fields.find((f) => f.path === 'age');
      expect(ageField).toBeDefined();
      expect(ageField!.required).toBe(false);

      // Create form using ingested field info
      const initialData: Record<string, unknown> = {};
      for (const field of ingestion.fields) {
        initialData[field.path] = undefined;
      }
      const form = createForm({ initialData });
      form.setValue('firstName', 'Jane');
      form.setValue('lastName', 'Doe');

      const data = form.getState().data as Record<string, unknown>;
      expect(data.firstName).toBe('Jane');

      form.dispose();
    });

    test('F5/F8: validation issue sorting by severity', () => {
      // sortIssues orders by severity: error > warning > info
      const source = { origin: 'function-validator' as const, validatorId: 'test' };
      const issues = [
        { path: parsePath('b'), severity: 'warning' as const, message: 'warn', code: 'W1', stage: 'draft', source },
        { path: parsePath('a'), severity: 'error' as const, message: 'err', code: 'E1', stage: 'draft', source },
        { path: parsePath('c'), severity: 'info' as const, message: 'info', code: 'I1', stage: 'draft', source },
      ];

      const policy = createDefaultStagePolicy();
      const sorted = sortIssues(issues, policy);
      expect(sorted[0]!.severity).toBe('error');
      expect(sorted[1]!.severity).toBe('warning');
      expect(sorted[2]!.severity).toBe('info');
    });
  });

  // --- (c) Expression-driven visibility: F3 predicate + arbiter rules ---
  describe('(c) Expression-driven visibility — F3 predicate + arbiter rules', () => {
    test('compile predicate, arbiter rule applies writes to form state', () => {
      // F3: compile a predicate AST
      const ast = compile({ $eq: [{ $path: 'country' }, 'US'] });
      expect(ast.kind).toBe('op');

      // Evaluate against scope where country = 'US'
      const scopeUS = { country: 'US', $ui: {}, $meta: {} };
      const resultUS = evaluate(ast, scopeUS);
      expect(resultUS).toBe(true);

      // Evaluate against scope where country != 'US'
      const scopeUK = { country: 'UK', $ui: {}, $meta: {} };
      const resultUK = evaluate(ast, scopeUK);
      expect(resultUK).toBe(false);

      // Execute via arbiter: when country=US, show state field
      const form = createForm({
        initialData: { country: 'US' },
        arbiterRules: [{
          name: 'show-state',
          when: { country: { $eq: 'US' } },
          then: [{ type: 'set', path: '$ui.stateVisible', value: true }],
        }],
      });

      // Trigger pipeline
      form.setValue('country', 'US');
      expect((form.getState().uiState as Record<string, unknown>).stateVisible).toBe(true);

      form.dispose();
    });
  });

  // --- (d) Transform pipeline end-to-end: F9 ---
  describe('(d) Transform pipeline — F9 ingress/field/egress', () => {
    test('full transform pipeline with date fields', () => {
      const transforms: TransformDefinition[] = [
        {
          id: 'ingress:parse-date',
          phase: 'ingress',
          transform(value: unknown): unknown {
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
              return new Date(`${value}T00:00:00.000Z`);
            }
            return value;
          },
        },
        createDateTransform(),
        createDateEgressTransform(),
      ];

      const ctx = { state: {} };

      // Ingress: "2025-06-15" → Date object
      const afterIngress = runTransforms(transforms, 'ingress', '2025-06-15', ctx);
      expect(afterIngress).toBeInstanceOf(Date);

      // Field: Date → ISO string
      const afterField = runTransforms(transforms, 'field', afterIngress, ctx);
      expect(afterField).toBe('2025-06-15T00:00:00.000Z');

      // Egress: ISO string passes through
      const afterEgress = runTransforms(transforms, 'egress', afterField, ctx);
      expect(afterEgress).toBe('2025-06-15T00:00:00.000Z');

      // Store in form and verify
      const form = createForm({ initialData: {} });
      form.setValue('birthDate', afterField);
      const data = form.getState().data as Record<string, unknown>;
      expect(data.birthDate).toBe('2025-06-15T00:00:00.000Z');

      form.dispose();
    });
  });

  // --- (e) Extension validation: F10 ---
  describe('(e) Extension validation — F10 capabilities', () => {
    test('validate extension manifest with capabilities', () => {
      const supportedCaps = new Map<string, { version: string; stability: 'stable' | 'experimental' }>([
        ['expr-engine.v1', { version: '1.0.0', stability: 'stable' }],
        ['operators.v1', { version: '1.0.0', stability: 'stable' }],
      ]);

      const manifest: ExtensionManifest = {
        id: 'test-extension',
        apiVersion: '1.0.0',
        capabilities: ['expr-engine.v1'],
      };

      // Should not throw
      clearExtensionRegistry();
      expect(() => validateExtension(manifest, supportedCaps)).not.toThrow();

      // Version compatibility
      expect(isCompatibleVersion('1.2.0', '1.0.0', 'stable')).toBe(true);
      expect(isCompatibleVersion('2.0.0', '1.0.0', 'stable')).toBe(false);

      // Stable capabilities are defined
      expect(STABLE_CAPABILITIES.length).toBeGreaterThan(0);
    });
  });
});
