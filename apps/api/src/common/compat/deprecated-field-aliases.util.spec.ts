import { applyDeprecatedFieldAliases } from './deprecated-field-aliases.util';

describe('applyDeprecatedFieldAliases', () => {
  const aliases = { old_name: 'new_name' };

  it('moves a deprecated field to its canonical name', () => {
    expect(applyDeprecatedFieldAliases({ old_name: 1, other: 2 }, aliases)).toEqual({ new_name: 1, other: 2 });
  });

  it('keeps the canonical value when both names are sent', () => {
    expect(applyDeprecatedFieldAliases({ old_name: 1, new_name: 3 }, aliases)).toEqual({ new_name: 3 });
  });

  it('carries an explicit null (a cleared field) to the canonical name', () => {
    expect(applyDeprecatedFieldAliases({ old_name: null }, aliases)).toEqual({ new_name: null });
  });

  it('leaves canonical input untouched and does not mutate the argument', () => {
    const input = { new_name: 1 };
    expect(applyDeprecatedFieldAliases(input, aliases)).toEqual({ new_name: 1 });
    const legacy = { old_name: 1 };
    applyDeprecatedFieldAliases(legacy, aliases);
    expect(legacy).toEqual({ old_name: 1 });
  });
});
