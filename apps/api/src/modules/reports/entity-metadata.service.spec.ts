import { EntityMetadataService } from './entity-metadata.service';
import { EntityCategory } from './entity-metadata.types';

/**
 * PHASE 1 — ensures a real, classified scan with no UNKNOWN entity.
 * Runs without a database (reads decorator metadata via getMetadataArgsStorage).
 */
describe('EntityMetadataService — entity-driven inventory', () => {
  const inv = new EntityMetadataService().scan();
  const byTable = new Map(inv.entities.map((e) => [e.tableName, e]));

  it('scans a real set of registered entities', () => {
    expect(inv.totalEntities).toBeGreaterThan(100);
    expect(inv.entities.length).toBe(inv.totalEntities);
    expect(inv.reportableEntities + inv.nonReportableEntities).toBe(inv.totalEntities);
  });

  // ── VALIDATION 1 / 4: no entity without a classification ────────────────────
  it('leaves NO entity UNKNOWN (every operational entity classified)', () => {
    const unknown = inv.entities.filter((e) => e.category === EntityCategory.UNKNOWN);
    expect(unknown.map((e) => e.tableName)).toEqual([]);
    expect(inv.unknownEntities).toBe(0);
  });

  // ── VALIDATION 2: every reportable entity has tenant_id ────────────────────
  it('every reportable entity has tenant_id', () => {
    const offenders = inv.entities.filter((e) => e.reportable && !e.hasTenantId);
    expect(offenders.map((e) => e.tableName)).toEqual([]);
  });

  // ── VALIDATION 3: every reportable entity has an identifiable column ─────────
  it('every reportable entity has an identifiable column', () => {
    const offenders = inv.entities.filter(
      (e) => e.reportable && e.risks.includes('NO_IDENTIFIABLE_COLUMN'),
    );
    expect(offenders.map((e) => e.tableName)).toEqual([]);
  });

  // ── VALIDATION 4: every REPORTABLE entity has a pt-BR label (label is product) ─
  it('every REPORTABLE entity has a pt-BR label in the central layer', () => {
    const offenders = inv.entities.filter(
      (e) => e.category === EntityCategory.REPORTABLE && e.label === null,
    );
    expect(offenders.map((e) => e.tableName)).toEqual([]);
    const untranslated = inv.entities.filter((e) => e.risks.includes('UNTRANSLATED_ENTITY'));
    expect(untranslated.map((e) => e.tableName)).toEqual([]);
  });

  // ── VALIDATION 5: infra/security/billing/ai/junction are NOT reportable ─────────
  it('audit_logs, billing, auth, health, ai_* and junctions are not reportable', () => {
    const mustNotBeReportable: Array<[string, EntityCategory]> = [
      ['audit_logs', EntityCategory.SECURITY],
      ['auth', EntityCategory.SECURITY],
      ['users', EntityCategory.SECURITY],
      ['billing_subscriptions', EntityCategory.BILLING],
      ['health', EntityCategory.INFRA],
      ['ai_jobs', EntityCategory.AI_INTERNAL],
      ['ai_usage_logs', EntityCategory.AI_INTERNAL],
      ['skill_runs', EntityCategory.AI_INTERNAL],
      ['crm_contact_tags', EntityCategory.JUNCTION],
      ['role_permissions', EntityCategory.JUNCTION],
    ];
    for (const [table, expectedCat] of mustNotBeReportable) {
      const e = byTable.get(table);
      if (!e) continue; // may not be registered in the DataSource
      expect(e.reportable).toBe(false);
      expect(e.category).toBe(expectedCat);
    }
  });

  // Part 89: the reportable core is exactly the closed registry (22 authorized
  // modules) — see report-module-registry.ts.
  it('core operational entities are reportable (with tenant_id)', () => {
    for (const table of [
      'artists', 'works', 'phonograms', 'contracts', 'clients', 'employees', 'projects',
      'content_detections', 'licenses', 'takedowns', 'releases', 'shares',
      'audiovisual_projects', 'transactions', 'invoices', 'events', 'inventory_items',
      'leads', 'marketing_tasks', 'marketing_content_posts', 'briefings',
    ]) {
      const e = byTable.get(table);
      if (!e) continue;
      expect(e.category).toBe(EntityCategory.REPORTABLE);
      expect(e.hasTenantId).toBe(true);
      expect(e.reportable).toBe(true);
    }
  });

  it('entities outside the closed registry (Part 89) are NOT_REPORTABLE', () => {
    for (const table of ['contract_templates', 'operational_tasks', 'artist_goals', 'support_tickets']) {
      const e = byTable.get(table);
      if (!e) continue;
      expect(e.category).toBe(EntityCategory.NOT_REPORTABLE);
      expect(e.reportable).toBe(false);
    }
  });

  it('each entity report has the expected shape', () => {
    const e = byTable.get('artists');
    expect(e).toBeDefined();
    expect(e!.entityName).toBeTruthy();
    expect(Array.isArray(e!.columns)).toBe(true);
    expect(e!.columns.length).toBeGreaterThan(0);
    expect(Array.isArray(e!.relations)).toBe(true);
    expect(typeof e!.hasTenantId).toBe('boolean');
    expect(typeof e!.hasSoftDelete).toBe('boolean');
    expect(typeof e!.hasTimestamps).toBe('boolean');
    expect(Array.isArray(e!.risks)).toBe(true);
  });
});
