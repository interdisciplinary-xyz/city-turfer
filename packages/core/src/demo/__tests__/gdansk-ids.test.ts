import { demoActivityId, isGdanskPlanActivityId, planGdanskDemo } from '../gdansk';

describe('Gdańsk demo ids', () => {
  it('every planned activity has a plan id; nothing else does', () => {
    const plan = planGdanskDemo(Date.parse('2026-10-24T00:00:00Z'));
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.every((p) => isGdanskPlanActivityId(p.id))).toBe(true);
    expect(isGdanskPlanActivityId(demoActivityId(0))).toBe(true);
    for (const id of [
      'demo-1759302000000',
      'demo-gdansk-1759302000000',
      'demo-gdansk-n',
      'xdemo-gdansk-n1',
      'demo-gdansk-n1 ',
    ]) {
      expect(isGdanskPlanActivityId(id)).toBe(false);
    }
  });
});
