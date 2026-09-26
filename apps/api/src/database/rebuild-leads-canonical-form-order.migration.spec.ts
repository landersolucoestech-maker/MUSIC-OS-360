import * as fs from 'fs';
import * as path from 'path';

/**
 * Guarda permanente (auditoria 2026-07-19): reconstrução física de `leads`
 * na ordem do formulário real (LeadFormModal) — "Dados do Contato" é a
 * primeira seção real. Renomeia tipoServico/origemLead/probabilidadeFechamento
 * para snake_case e remove score/pipeline_stage (órfãs comprovadas).
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000011_RebuildLeadsInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildLeadsInCanonicalFormOrder20260719000011', () => {
  it('nome/nome_completo/empresa come right after id/tenant_id (contact details section)', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const idIdx = block.indexOf('id ');
    const tenantIdx = block.indexOf('tenant_id ');
    const nomeIdx = block.search(/\bnome\s+varchar/);
    const empresaIdx = block.indexOf('empresa ');
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(nomeIdx).toBeGreaterThan(tenantIdx);
    expect(empresaIdx).toBeGreaterThan(nomeIdx);
  });

  it('renames tipoServico/origemLead/probabilidadeFechamento to snake_case (new physical columns)', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    expect(block).toMatch(/\btipo_servico\s+varchar/);
    expect(block).toMatch(/\borigem_lead\s+varchar/);
    expect(block).toMatch(/\bprobabilidade_fechamento\s+numeric/);
    expect(block).not.toMatch(/"tipoServico"|"origemLead"|"probabilidadeFechamento"/);
  });

  it('drops score/pipeline_stage (proven orphans) with fail-fast validation', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    expect(block).not.toMatch(/\bscore\b/);
    expect(block).not.toMatch(/\bpipeline_stage\b/);
    expect(migrationSrc).toMatch(/count\(score\)::int \+ count\(pipeline_stage\)::int/);
    expect(migrationSrc).toMatch(/presumidas órfãs, mas há dado real/);
  });

  it('nenhum campo funcional aparece depois de metadata/created_at/updated_at/deleted_at', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const deletedAtIdx = block.indexOf('deleted_at');
    const afterDeletedAt = block.slice(deletedAtIdx + 'deleted_at'.length).trim();
    expect(afterDeletedAt.replace(/timestamp,?/, '').trim()).toBe('');
  });

  it('does not use DROP ... CASCADE', () => {
    expect(migrationSrc).not.toMatch(/DROP\s+\w+[^;]*CASCADE/i);
  });

  it('recria as 5 FKs dependentes (conversations, form_submissions, lead_uploads x2, lead_interactions), RLS + policies e possui down() honesto', () => {
    for (const conname of [
      'conversations_contact_id_fkey', 'form_submissions_lead_id_fkey', 'lead_uploads_lead_id_fkey',
      'fk_lead_uploads_lead_tenant', 'fk_lead_interactions_lead_id',
    ]) {
      expect(migrationSrc.match(new RegExp(`ADD CONSTRAINT ${conname}`, 'g'))?.length).toBeGreaterThanOrEqual(1);
    }
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/contagem divergente/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
