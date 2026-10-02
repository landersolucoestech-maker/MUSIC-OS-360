import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { applyDeprecatedFieldAliases } from '../../../common/compat/deprecated-field-aliases.util';
import { INVOICE_DEPRECATED_FIELDS } from '../invoice-legacy-fields';
import { CreateInvoiceDto } from './invoices.dto';

describe('CreateInvoiceDto legacy fields (legacy in, canonical out)', () => {
  const saleId = '0b2c1f5e-6a1d-4f7e-9d3a-1c2b3d4e5f60';

  it.each([['venda_id', 'sale_id', saleId]])('accepts %s and maps it to %s', async (legacy, canonical, value) => {
    const payload = { [legacy]: value };
    const errors = await validate(plainToInstance(CreateInvoiceDto, payload), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.filter((e) => e.property === legacy)).toEqual([]);
    const moved = applyDeprecatedFieldAliases(payload, INVOICE_DEPRECATED_FIELDS) as Record<string, unknown>;
    expect(moved[canonical]).toBe(value);
    expect(moved).not.toHaveProperty(legacy);
  });

  it('rejects a non-UUID legacy venda_id', async () => {
    const errors = await validate(plainToInstance(CreateInvoiceDto, { venda_id: 'abc' }));
    expect(errors.map((e) => e.property)).toContain('venda_id');
  });
});
