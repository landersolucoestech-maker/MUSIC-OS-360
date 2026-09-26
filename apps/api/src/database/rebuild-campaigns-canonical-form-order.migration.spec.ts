import * as fs from 'fs';
import * as path from 'path';

/**
 * Guarda permanente (auditoria 2026-07-19): reconstrução física de
 * `campaigns` — restrita ao bloco de auditoria (created_by/updated_by
 * antes de deleted_at). Pendência de nomenclatura DTO×entidade
 * (CreateCampaignDto vs colunas físicas) registrada no cabeçalho da
 * migration, não corrigida aqui.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000024_RebuildCampaignsInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildCampaignsInCanonicalFormOrder20260719000024', () => {
  const block = () => migrationSrc.split('newColumns = `')[1].split('`;')[0];

  it('keeps the existing functional order: nome -> tipo -> status -> objetivo -> orcamento -> data_inicio -> data_fim -> artista_id', () => {
    const b = block();
    const nomeIdx = b.search(/\bnome\s+varchar/);
    const tipoIdx = b.indexOf('tipo');
    const statusIdx = b.search(/\bstatus\s+varchar/);
    const objetivoIdx = b.indexOf('objetivo');
    const orcamentoIdx = b.indexOf('orcamento');
    const inicioIdx = b.indexOf('data_inicio');
    const fimIdx = b.indexOf('data_fim');
    const artistaIdx = b.indexOf('artista_id');
    expect(tipoIdx).toBeGreaterThan(nomeIdx);
    expect(statusIdx).toBeGreaterThan(tipoIdx);
    expect(objetivoIdx).toBeGreaterThan(statusIdx);
    expect(orcamentoIdx).toBeGreaterThan(objetivoIdx);
    expect(inicioIdx).toBeGreaterThan(orcamentoIdx);
    expect(fimIdx).toBeGreaterThan(inicioIdx);
    expect(artistaIdx).toBeGreaterThan(fimIdx);
  });

  it('the audit block is created_at -> updated_at -> created_by -> updated_by -> deleted_at', () => {
    const b = block();
    const createdAtIdx = b.indexOf('created_at');
    const updatedAtIdx = b.indexOf('updated_at');
    const createdByIdx = b.indexOf('created_by');
    const updatedByIdx = b.indexOf('updated_by');
    const deletedAtIdx = b.indexOf('deleted_at');
    expect(updatedAtIdx).toBeGreaterThan(createdAtIdx);
    expect(createdByIdx).toBeGreaterThan(updatedAtIdx);
    expect(updatedByIdx).toBeGreaterThan(createdByIdx);
    expect(deletedAtIdx).toBeGreaterThan(updatedByIdx);
  });

  it('documents the pending DTO×entity naming issue and the absence of a real frontend caller', () => {
    expect(migrationSrc).toMatch(/ACHADO CRÍTICO/);
    expect(migrationSrc).toMatch(/CreateCampaignDto/);
    expect(migrationSrc).toMatch(/marketing\/campaigns/);
  });

  it('removes no column (pure order rebuild)', () => {
    const newBlock = block();
    const origBlock = migrationSrc.split('originalColumns = `')[1].split('`;')[0];
    const extractCols = (b: string) => [...b.matchAll(/^\s*(\w+)\s+/gm)].map((m) => m[1]);
    const newCols = new Set(extractCols(newBlock));
    const origCols = new Set(extractCols(origBlock));
    expect(newCols.size).toBe(origCols.size);
    for (const col of origCols) expect(newCols.has(col)).toBe(true);
  });

  it('does not use DROP ... CASCADE', () => {
    expect(migrationSrc).not.toMatch(/DROP\s+\w+[^;]*CASCADE/i);
  });

  it('drops and recreates every dependent FK (campaign_tasks, campaign_assets, briefings) and the composite ones', () => {
    expect(migrationSrc).toMatch(/ALTER TABLE campaign_tasks DROP CONSTRAINT campaign_tasks_campaign_id_fkey/);
    expect(migrationSrc).toMatch(/ALTER TABLE campaign_tasks DROP CONSTRAINT fk_campaign_tasks_campaign_tenant/);
    expect(migrationSrc).toMatch(/ALTER TABLE campaign_assets DROP CONSTRAINT campaign_assets_campaign_id_fkey/);
    expect(migrationSrc).toMatch(/ALTER TABLE campaign_assets DROP CONSTRAINT fk_campaign_assets_campaign_tenant/);
    expect(migrationSrc).toMatch(/ALTER TABLE briefings DROP CONSTRAINT fk_briefings_campanha_id/);
    expect(migrationSrc.match(/ADD CONSTRAINT fk_briefings_campanha_id FOREIGN KEY \(campanha_id\) REFERENCES campaigns\(id\) ON DELETE SET NULL/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('recria RLS + as duas policies (tenant_isolation, super_admin_full_access) e possui down() honesto', () => {
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/CREATE POLICY tenant_isolation/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc.match(/CREATE POLICY super_admin_full_access/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc.match(/contagem divergente/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
