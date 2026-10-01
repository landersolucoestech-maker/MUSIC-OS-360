import { canonicalPlanFeatures } from './plan-features';

describe('canonicalPlanFeatures', () => {
  it('renames moduleRh to moduleHr and keeps every other key', () => {
    expect(canonicalPlanFeatures({ moduleRh: true, moduleCrm: true, integrations: { x: 1 } })).toEqual({ moduleHr: true, moduleCrm: true, integrations: { x: 1 } });
  });
  it('canonical wins when both are present; idempotent; tolerant of empty input', () => {
    expect(canonicalPlanFeatures({ moduleRh: true, moduleHr: false })).toEqual({ moduleHr: false });
    const once = canonicalPlanFeatures({ moduleRh: false });
    expect(canonicalPlanFeatures(once)).toEqual(once);
    expect(canonicalPlanFeatures({})).toEqual({});
    expect(canonicalPlanFeatures(null as never)).toEqual({});
  });
});
