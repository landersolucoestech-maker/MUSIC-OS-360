import { entityCopyPtBr, fieldCopyPtBr } from './report-copy.pt-br';

describe('Reports Center end-user copy helpers', () => {
  it('render translated tables and columns by their PT-BR label', () => {
    expect(entityCopyPtBr('artists')).toMatch(/^"[^"_]+"$/);
    expect(entityCopyPtBr('artists')).not.toContain('artists');
    expect(fieldCopyPtBr('email')).toBe('"E-mail"');
  });

  it('never echo an untranslated technical key', () => {
    expect(entityCopyPtBr('some_internal_table')).toBe('esta entidade');
    expect(fieldCopyPtBr('some_internal_column')).toBe('um dos campos');
  });
});
