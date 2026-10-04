import { readLastPayment, withLastPayment } from './contract-last-payment';

describe('contract last-payment metadata keys', () => {
  it('writes the canonical keys, removes the legacy ones and preserves every other key', () => {
    const out = withLastPayment({ keep: 1, ultimo_pagamento_em: 'old', ultimo_pagamento_valor: '1', ultimo_pagamento_por: 'u0' }, { at: '2026-06-12', amount: '100', by: 'u1' });
    expect(out).toEqual({ keep: 1, last_payment_at: '2026-06-12', last_payment_amount: '100', last_payment_by: 'u1' });
  });
  it('tolerates empty metadata', () => {
    expect(withLastPayment(null, { at: 'a', amount: 'b', by: 'c' })).toEqual({ last_payment_at: 'a', last_payment_amount: 'b', last_payment_by: 'c' });
  });
  it('reads canonical first, legacy as fallback', () => {
    expect(readLastPayment({ ultimo_pagamento_em: 'o', ultimo_pagamento_valor: 'ov', ultimo_pagamento_por: 'op' })).toEqual({ at: 'o', amount: 'ov', by: 'op' });
    expect(readLastPayment({ last_payment_at: 'n', ultimo_pagamento_em: 'o' }).at).toBe('n');
    expect(readLastPayment(undefined)).toEqual({ at: undefined, amount: undefined, by: undefined });
  });
});

describe('readLastPayment: the canonical key wins over the legacy key, field by field', () => {
  const PAIRS: ReadonlyArray<readonly [field: 'at' | 'amount' | 'by', canonical: string, legacy: string]> = [
    ['at', 'last_payment_at', 'ultimo_pagamento_em'],
    ['amount', 'last_payment_amount', 'ultimo_pagamento_valor'],
    ['by', 'last_payment_by', 'ultimo_pagamento_por'],
  ];

  it.each(PAIRS)('%s: both spellings with different values -> the canonical one', (field, canonical, legacy) => {
    expect(readLastPayment({ [legacy]: 'legacy-value', [canonical]: 'canonical-value' })[field]).toBe('canonical-value');
    expect(readLastPayment({ [canonical]: 'canonical-value', [legacy]: 'legacy-value' })[field]).toBe('canonical-value');
  });

  it.each(PAIRS)('%s: a canonical null is a real value and still wins; the legacy one is only a fallback when the canonical is absent', (field, canonical, legacy) => {
    expect(readLastPayment({ [canonical]: null, [legacy]: 'legacy-value' })[field]).toBeNull();
    expect(readLastPayment({ [legacy]: 'legacy-value' })[field]).toBe('legacy-value');
  });
});
