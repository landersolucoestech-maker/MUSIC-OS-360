import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateFinanceCategoryRuleDto, QueryFinanceCategoryRuleDto } from './finance-category-rules.dto';

const CATEGORY = '123e4567-e89b-12d3-a456-426614174000';

describe('finance category rule DTO legacy transaction type (CZ-041)', () => {
  it.each([['RECEITA', 'REVENUE'], ['despesa', 'EXPENSE'], ['REVENUE', 'REVENUE']])('create maps %s to %s before validation', (sent, canonical) => {
    const dto = plainToInstance(CreateFinanceCategoryRuleDto, { keywords: ['x'], transaction_type: sent, category_id: CATEGORY });
    expect(validateSync(dto)).toEqual([]);
    expect(dto.transaction_type).toBe(canonical);
  });

  it('create still rejects an unknown transaction type', () => {
    const dto = plainToInstance(CreateFinanceCategoryRuleDto, { keywords: ['x'], transaction_type: 'TRANSFERENCIA', category_id: CATEGORY });
    expect(validateSync(dto).map((e) => e.property)).toEqual(['transaction_type']);
  });

  it('query maps the legacy value to the canonical one', () => {
    expect(plainToInstance(QueryFinanceCategoryRuleDto, { transaction_type: 'DESPESA' }).transaction_type).toBe('EXPENSE');
    expect(plainToInstance(QueryFinanceCategoryRuleDto, { transaction_type: 'RECEITA' }).transaction_type).toBe('REVENUE');
  });
});
