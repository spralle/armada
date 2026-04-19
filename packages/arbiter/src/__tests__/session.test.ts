import { describe, it, expect } from 'bun:test';
import { createSession } from '../session.js';
import { ArbiterError, ArbiterErrorCode } from '../errors.js';

// ---------------------------------------------------------------------------
// Basic session
// ---------------------------------------------------------------------------

describe('createSession', () => {
  it('returns a valid RuleSession with no config', () => {
    const session = createSession();
    expect(session.getState()).toEqual({});
    expect(session.fire().rulesFired).toBe(0);
  });

  it('initializes with provided state', () => {
    const session = createSession({ initialState: { name: 'Alice' } });
    expect(session.getState()).toEqual({ name: 'Alice' });
    expect(session.getPath('name')).toBe('Alice');
  });
});

// ---------------------------------------------------------------------------
// Rule registration
// ---------------------------------------------------------------------------

describe('registerRule / removeRule', () => {
  it('registers a rule that fires on matching conditions', () => {
    const session = createSession({ initialState: { shipmentType: 'hazmat' } });
    session.registerRule({
      name: 'hazmat-warning',
      when: { shipmentType: 'hazmat' },
      then: [{ $set: { '$ui.hazmatWarning.visible': true } }],
    });
    const result = session.fire();
    expect(result.rulesFired).toBe(1);
    expect(session.getPath('$ui.hazmatWarning.visible')).toBe(true);
  });

  it('removeRule removes a rule and retracts its TMS writes', () => {
    const session = createSession({
      initialState: { shipmentType: 'hazmat' },
      rules: [{
        name: 'hazmat-warning',
        when: { shipmentType: 'hazmat' },
        then: [{ $set: { '$ui.hazmatWarning.visible': true } }],
      }],
    });
    session.fire();
    expect(session.getPath('$ui.hazmatWarning.visible')).toBe(true);

    session.removeRule('hazmat-warning');
    expect(session.getPath('$ui.hazmatWarning.visible')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Fire cycle — simple
// ---------------------------------------------------------------------------

describe('fire cycle', () => {
  it('fires a simple visibility rule', () => {
    const session = createSession({
      initialState: { shipmentType: 'hazmat' },
      rules: [{
        name: 'hazmat-warning',
        when: { shipmentType: 'hazmat' },
        then: [{ $set: { '$ui.hazmatWarning.visible': true } }],
      }],
    });
    const result = session.fire();
    expect(result.rulesFired).toBe(1);
    expect(session.getPath('$ui.hazmatWarning.visible')).toBe(true);
  });

  it('does not fire when condition is false', () => {
    const session = createSession({
      initialState: { shipmentType: 'standard' },
      rules: [{
        name: 'hazmat-warning',
        when: { shipmentType: 'hazmat' },
        then: [{ $set: { '$ui.hazmatWarning.visible': true } }],
      }],
    });
    const result = session.fire();
    expect(result.rulesFired).toBe(0);
    expect(session.getPath('$ui.hazmatWarning.visible')).toBeUndefined();
  });

  it('chains rules through dependency propagation', () => {
    const session = createSession({
      initialState: { price: 100, taxRate: 0.1 },
      rules: [
        {
          name: 'calc-tax',
          when: { price: { $gt: 0 } },
          then: [{ $set: { '$state.tax': { $multiply: ['$price', '$taxRate'] } } }],
        },
        {
          name: 'calc-total',
          when: { '$state.tax': { $exists: true } },
          then: [{ $set: { '$state.total': { $sum: ['$price', '$state.tax'] } } }],
        },
      ],
    });
    const result = session.fire();
    expect(result.rulesFired).toBe(2);
    expect(session.getPath('$state.total')).toBe(110);
  });
});

// ---------------------------------------------------------------------------
// TMS retraction
// ---------------------------------------------------------------------------

describe('TMS retraction', () => {
  it('retracts $ui writes when condition becomes false', () => {
    const session = createSession({
      initialState: { shipmentType: 'hazmat' },
      rules: [{
        name: 'hazmat-warning',
        when: { shipmentType: 'hazmat' },
        then: [{ $set: { '$ui.warning.visible': true } }],
      }],
    });
    session.fire();
    expect(session.getPath('$ui.warning.visible')).toBe(true);

    session.update('shipmentType', 'standard');
    expect(session.getPath('$ui.warning.visible')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Reactive API
// ---------------------------------------------------------------------------

describe('reactive API', () => {
  it('subscribe notifies on path changes during fire', () => {
    const session = createSession({
      initialState: { shipmentType: 'hazmat' },
      rules: [{
        name: 'hazmat-warning',
        when: { shipmentType: 'hazmat' },
        then: [{ $set: { '$ui.warning.visible': true } }],
      }],
    });

    const calls: unknown[] = [];
    session.subscribe('$ui.warning.visible', (val, prev) => {
      calls.push({ val, prev });
    });

    session.fire();
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]).toEqual({ val: true, prev: undefined });
  });

  it('unsubscribe stops notifications', () => {
    const session = createSession({
      initialState: { shipmentType: 'hazmat' },
      rules: [{
        name: 'hazmat-warning',
        when: { shipmentType: 'hazmat' },
        then: [{ $set: { '$ui.warning.visible': true } }],
      }],
    });

    const calls: unknown[] = [];
    const unsub = session.subscribe('$ui.warning.visible', (val) => {
      calls.push(val);
    });
    unsub();

    session.fire();
    expect(calls.length).toBe(0);
  });

  it('update asserts value and fires', () => {
    const session = createSession({
      rules: [{
        name: 'show-name',
        when: { name: { $exists: true } },
        then: [{ $set: { '$ui.nameVisible': true } }],
      }],
    });

    const result = session.update('name', 'Alice');
    expect(result.rulesFired).toBe(1);
    expect(session.getPath('$ui.nameVisible')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Conflict resolution (salience)
// ---------------------------------------------------------------------------

describe('conflict resolution', () => {
  it('higher salience fires first', () => {
    const fired: string[] = [];
    const session = createSession({
      initialState: { active: true },
      rules: [
        {
          name: 'low',
          salience: 1,
          when: { active: true },
          then: [{ $set: { '$state.low': true } }],
        },
        {
          name: 'high',
          salience: 10,
          when: { active: true },
          then: [{ $set: { '$state.high': true } }],
        },
      ],
    });

    const result = session.fire();
    expect(result.rulesFired).toBe(2);
    // High salience should fire first — check changes order
    expect(result.changes[0]?.ruleName).toBe('high');
    expect(result.changes[1]?.ruleName).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// Cycle limit
// ---------------------------------------------------------------------------

describe('cycle limit', () => {
  it('throws when cycle limit exceeded', () => {
    const session = createSession({
      initialState: { a: true },
      limits: { maxCycles: 5 },
      rules: [
        {
          name: 'toggle-a',
          when: { '$state.b': { $exists: true } },
          then: [{ $set: { '$state.a': true } }],
        },
        {
          name: 'toggle-b',
          when: { '$state.a': { $exists: true } },
          then: [{ $set: { '$state.b': true } }],
        },
      ],
    });

    // These rules create a chain but since set is idempotent,
    // they won't infinitely loop. Use inc to force changes.
    const session2 = createSession({
      initialState: { counter: 0 },
      limits: { maxCycles: 3 },
      rules: [
        {
          name: 'inc-counter',
          when: { counter: { $gte: 0 } },
          then: [{ $inc: { counter: 1 } }],
        },
      ],
    });

    expect(() => session2.fire()).toThrow(ArbiterError);
  });
});

// ---------------------------------------------------------------------------
// Disposed
// ---------------------------------------------------------------------------

describe('disposed session', () => {
  it('throws SESSION_DISPOSED after dispose', () => {
    const session = createSession();
    session.dispose();

    expect(() => session.fire()).toThrow(ArbiterError);
    expect(() => session.assert('foo', 1)).toThrow(ArbiterError);
    expect(() => session.getState()).toThrow(ArbiterError);
  });
});

// ---------------------------------------------------------------------------
// Else branch
// ---------------------------------------------------------------------------

describe('else branch', () => {
  it('executes else actions when condition is false', () => {
    const session = createSession({
      initialState: { shipmentType: 'standard' },
      rules: [{
        name: 'hazmat-check',
        when: { shipmentType: 'hazmat' },
        then: [{ $set: { '$ui.hazmatForm.visible': true } }],
        else: [{ $set: { '$ui.hazmatForm.visible': false } }],
      }],
    });
    session.fire();
    expect(session.getPath('$ui.hazmatForm.visible')).toBe(false);
  });

  it('does not execute else when condition is true', () => {
    const session = createSession({
      initialState: { shipmentType: 'hazmat' },
      rules: [{
        name: 'hazmat-check',
        when: { shipmentType: 'hazmat' },
        then: [{ $set: { '$ui.hazmatForm.visible': true } }],
        else: [{ $set: { '$ui.hazmatForm.visible': false } }],
      }],
    });
    session.fire();
    expect(session.getPath('$ui.hazmatForm.visible')).toBe(true);
  });

  it('does not TMS-retract else writes (hasTms is false)', () => {
    const session = createSession({
      initialState: { shipmentType: 'standard' },
      rules: [{
        name: 'hazmat-check',
        when: { shipmentType: 'hazmat' },
        then: [{ $set: { '$ui.hazmatForm.visible': true } }],
        else: [{ $set: { '$ui.hazmatForm.visible': false } }],
      }],
    });
    session.fire();
    expect(session.getPath('$ui.hazmatForm.visible')).toBe(false);

    // Change condition to true — else writes should NOT be auto-retracted
    // because hasTms is false for rules with else branches
    session.update('shipmentType', 'hazmat');
    expect(session.getPath('$ui.hazmatForm.visible')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Assert / retract
// ---------------------------------------------------------------------------

describe('assert / retract', () => {
  it('assert sets a value without auto-firing', () => {
    const session = createSession({
      rules: [{
        name: 'check',
        when: { x: { $exists: true } },
        then: [{ $set: { '$state.found': true } }],
      }],
    });
    session.assert('x', 42);
    expect(session.getPath('x')).toBe(42);
    // Not fired yet
    expect(session.getPath('$state.found')).toBeUndefined();

    session.fire();
    expect(session.getPath('$state.found')).toBe(true);
  });

  it('retract removes a value', () => {
    const session = createSession({ initialState: { x: 42 } });
    session.retract('x');
    expect(session.getPath('x')).toBeUndefined();
  });
});
