import { describe, it, expect } from 'bun:test';
import { createSession } from '../session.js';

// ---------------------------------------------------------------------------
// Conformance: B2B logistics scenarios (ADR §15, §16)
// ---------------------------------------------------------------------------

describe('Conformance: B2B logistics scenarios', () => {

  it('hazmat shipment shows warning and requires hazmat form', () => {
    const session = createSession({
      initialState: {
        shipmentType: 'hazmat',
        weight: 500,
      },
      rules: [
        {
          name: 'hazmat-warning',
          when: { shipmentType: 'hazmat' },
          then: [
            { type: 'set', path: '$ui.hazmatWarning.visible', value: true },
            { type: 'set', path: '$ui.hazmatForm.required', value: true },
          ],
        },
        {
          name: 'standard-no-warning',
          when: { shipmentType: { $ne: 'hazmat' } },
          then: [
            { type: 'set', path: '$ui.hazmatWarning.visible', value: false },
            { type: 'set', path: '$ui.hazmatForm.required', value: false },
          ],
        },
      ],
    });

    const result = session.fire();
    expect(result.rulesFired).toBeGreaterThanOrEqual(1);
    expect(session.getPath('$ui.hazmatWarning.visible')).toBe(true);
    expect(session.getPath('$ui.hazmatForm.required')).toBe(true);
  });

  it('weight-based surcharge calculation', () => {
    const session = createSession({
      initialState: { weight: 150, baseRate: 10 },
      rules: [
        {
          name: 'heavy-surcharge',
          when: { weight: { $gt: 100 } },
          then: [
            { type: 'set', path: '$state.surcharge', value: { $multiply: ['$weight', 0.5] } },
          ],
        },
        {
          name: 'light-no-surcharge',
          when: { weight: { $lte: 100 } },
          then: [
            { type: 'set', path: '$state.surcharge', value: 0 },
          ],
        },
      ],
    });
    session.fire();
    expect(session.getPath('$state.surcharge')).toBe(75);
  });

  it('conditional field visibility with else branch', () => {
    const session = createSession({
      initialState: { mode: 'sea' },
      rules: [{
        name: 'container-fields',
        when: { mode: 'sea' },
        then: [
          { type: 'set', path: '$ui.containerSize.visible', value: true },
          { type: 'set', path: '$ui.vesselName.visible', value: true },
        ],
        else: [
          { type: 'set', path: '$ui.containerSize.visible', value: false },
          { type: 'set', path: '$ui.vesselName.visible', value: false },
        ],
      }],
    });
    session.fire();
    expect(session.getPath('$ui.containerSize.visible')).toBe(true);

    session.update('mode', 'air');
    expect(session.getPath('$ui.containerSize.visible')).toBe(false);
  });

  it('multi-rule chaining: line item totals', () => {
    const session = createSession({
      initialState: {
        quantity: 10,
        unitPrice: 25,
        taxRate: 0.08,
      },
      rules: [
        {
          name: 'calc-subtotal',
          when: { quantity: { $gt: 0 }, unitPrice: { $gt: 0 } },
          then: [{ type: 'set', path: '$state.subtotal', value: { $multiply: ['$quantity', '$unitPrice'] } }],
          salience: 10,
        },
        {
          name: 'calc-tax',
          when: { '$state.subtotal': { $gt: 0 } },
          then: [{ type: 'set', path: '$state.tax', value: { $multiply: ['$state.subtotal', '$taxRate'] } }],
          salience: 5,
        },
        {
          name: 'calc-total',
          when: { '$state.subtotal': { $gt: 0 }, '$state.tax': { $exists: true } },
          then: [{ type: 'set', path: '$state.total', value: { $sum: ['$state.subtotal', '$state.tax'] } }],
          salience: 1,
        },
      ],
    });
    const result = session.fire();
    expect(result.rulesFired).toBe(3);
    expect(session.getPath('$state.subtotal')).toBe(250);
    expect(session.getPath('$state.tax')).toBe(20);
    expect(session.getPath('$state.total')).toBe(270);
  });

  it('TMS auto-retract on $ui namespace when condition flips', () => {
    const session = createSession({
      initialState: { requiresApproval: true },
      rules: [{
        name: 'approval-section',
        when: { requiresApproval: true },
        then: [
          { type: 'set', path: '$ui.approvalSection.visible', value: true },
          { type: 'set', path: '$ui.approverField.required', value: true },
        ],
      }],
    });
    session.fire();
    expect(session.getPath('$ui.approvalSection.visible')).toBe(true);

    session.update('requiresApproval', false);
    expect(session.getPath('$ui.approvalSection.visible')).toBeUndefined();
    expect(session.getPath('$ui.approverField.required')).toBeUndefined();
  });

  it('salience-based conflict resolution fires both rules', () => {
    const session = createSession({
      initialState: { active: true },
      rules: [
        {
          name: 'low-priority',
          when: { active: true },
          then: [{ type: 'set', path: '$state.order', value: 'low' }],
          salience: 1,
        },
        {
          name: 'high-priority',
          when: { active: true },
          then: [{ type: 'set', path: '$state.order', value: 'high' }],
          salience: 10,
        },
      ],
    });
    const result = session.fire();
    expect(result.rulesFired).toBe(2);
  });

  it('reactive update triggers fire automatically', () => {
    const session = createSession({
      initialState: { count: 0 },
      rules: [{
        name: 'count-check',
        when: { count: { $gt: 5 } },
        then: [{ type: 'set', path: '$ui.warning.visible', value: true }],
      }],
    });
    session.fire();
    expect(session.getPath('$ui.warning.visible')).toBeUndefined();

    const result = session.update('count', 10);
    expect(result.rulesFired).toBeGreaterThanOrEqual(1);
    expect(session.getPath('$ui.warning.visible')).toBe(true);
  });

  it('subscription notification after fire cycle', () => {
    let notified = false;
    const session = createSession({
      initialState: { trigger: false },
      rules: [{
        name: 'trigger-rule',
        when: { trigger: true },
        then: [{ type: 'set', path: '$state.result', value: 'fired' }],
      }],
    });

    session.subscribe('$state.result', () => {
      notified = true;
    });

    session.update('trigger', true);
    expect(notified).toBe(true);
  });

  it('rule removal retracts writes via TMS', () => {
    const session = createSession({
      initialState: { flag: true },
      rules: [{
        name: 'removable-rule',
        when: { flag: true },
        then: [{ type: 'set', path: '$ui.panel.visible', value: true }],
      }],
    });
    session.fire();
    expect(session.getPath('$ui.panel.visible')).toBe(true);

    session.removeRule('removable-rule');
    expect(session.getPath('$ui.panel.visible')).toBeUndefined();
  });

  it('handles empty rule set gracefully', () => {
    const session = createSession({ initialState: { name: 'test' } });
    const result = session.fire();
    expect(result.rulesFired).toBe(0);
    expect(result.cycles).toBe(0);
  });
});
