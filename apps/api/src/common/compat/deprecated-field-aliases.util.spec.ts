import { applyDeprecatedFieldAliases } from './deprecated-field-aliases.util';

describe('applyDeprecatedFieldAliases', () => {
  const aliases = { old_name: 'new_name' };

  it('moves a deprecated field to its canonical name', () => {
    expect(applyDeprecatedFieldAliases({ old_name: 1, other: 2 }, aliases)).toEqual({ new_name: 1, other: 2 });
  });

  it('keeps the canonical value when both names are sent', () => {
    expect(applyDeprecatedFieldAliases({ old_name: 1, new_name: 3 }, aliases)).toEqual({ new_name: 3 });
  });

  it('drops an empty deprecated value instead of overwriting the canonical field (deploy-skew data loss)', () => {
    // A pre-rename build reads the canonical response as blanks and sends them
    // back as nulls on edit; moving them would wipe the stored value.
    expect(applyDeprecatedFieldAliases({ old_name: null }, aliases)).toEqual({});
    expect(applyDeprecatedFieldAliases({ old_name: '' }, aliases)).toEqual({});
    expect(applyDeprecatedFieldAliases({ old_name: undefined, other: 1 }, aliases)).toEqual({ other: 1 });
  });

  it('keeps falsy but meaningful values (0, false)', () => {
    expect(applyDeprecatedFieldAliases({ old_name: 0 }, aliases)).toEqual({ new_name: 0 });
    expect(applyDeprecatedFieldAliases({ old_name: false }, aliases)).toEqual({ new_name: false });
  });

  it('a cleared field sent under the canonical name is still honored', () => {
    expect(applyDeprecatedFieldAliases({ old_name: 'x', new_name: null }, aliases)).toEqual({ new_name: null });
  });

  it('leaves canonical input untouched and does not mutate the argument', () => {
    const input = { new_name: 1 };
    expect(applyDeprecatedFieldAliases(input, aliases)).toEqual({ new_name: 1 });
    const legacy = { old_name: 1 };
    applyDeprecatedFieldAliases(legacy, aliases);
    expect(legacy).toEqual({ old_name: 1 });
  });
});
