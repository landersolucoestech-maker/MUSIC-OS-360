import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { InvoiceEntity } from '../../database/entities';

/**
 * The persisted column of the fiscal document kind keeps its legacy name `tipo_nota` (no rename: owner decision R1);
 * the canonical API name `fiscal_document_type` is not a column of the entity.
 */
describe('InvoiceEntity: fiscal document kind column', () => {
  const columns = getMetadataArgsStorage().columns.filter((c) => c.target === InvoiceEntity).map((c) => c.propertyName);

  it('maps the persisted column tipo_nota', () => {
    expect(columns).toContain('tipo_nota');
  });

  it('negative: the canonical API name is not persisted as its own column (no second source of truth)', () => {
    expect(columns).not.toContain('fiscal_document_type');
    expect(columns).not.toContain('fiscal_kind_renamed');
  });
});
