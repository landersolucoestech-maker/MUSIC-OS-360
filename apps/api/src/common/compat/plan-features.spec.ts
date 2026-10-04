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
  it('canonical wins in BOTH key orders: a stale legacy flag listed after the canonical one must not override it', () => {
    const legacy = 'moduleRh';
    const canonical = 'moduleHr';
    expect(canonicalPlanFeatures({ [canonical]: false, [legacy]: true })).toEqual({ [canonical]: false });
    expect(canonicalPlanFeatures({ [legacy]: true, [canonical]: false })).toEqual({ [canonical]: false });
    expect(canonicalPlanFeatures({ [canonical]: true, [legacy]: false, moduleCrm: true })).toEqual({ [canonical]: true, moduleCrm: true });
  });
  it('legacy-only maps to canonical and drops the legacy key', () => {
    const out = canonicalPlanFeatures({ ['moduleRh']: false });
    expect(out).toEqual({ moduleHr: false });
    expect(Object.keys(out)).toEqual(['moduleHr']);
  });
});

describe('canonicalPlanFeatures: prototype-pollution guard', () => {
  it('a __proto__ key from parsed JSON is dropped, never assigned: the result keeps the plain Object prototype', () => {
    const hostile = JSON.parse('{"__proto__":{"polluted":true},"moduleHr":true}') as Record<string, unknown>;
    const out = canonicalPlanFeatures(hostile);
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect((out as { polluted?: unknown }).polluted).toBeUndefined();
    expect(Object.keys(out)).toEqual(['moduleHr']);
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });
});
