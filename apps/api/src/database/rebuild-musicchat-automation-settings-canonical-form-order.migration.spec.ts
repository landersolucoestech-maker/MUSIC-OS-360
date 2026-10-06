import * as fs from 'fs';
import * as path from 'path';

/**
 * Permanent guard (2026-07-19 audit): physical rebuild of
 * `musicchat_automation_settings` — the order already matched
 * UpdateMusicChatAutomationSettingsDto, except updated_by (it was before
 * created_at/updated_at) — fixed to the end of the audit block.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000021_RebuildMusicchatAutomationSettingsInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildMusicchatAutomationSettingsInCanonicalFormOrder20260719000021', () => {
  const block = () => migrationSrc.split('newColumns = `')[1].split('`;')[0];

  it('follows the DTO order: enabled -> welcome_message -> ... -> manager_user_id', () => {
    const b = block();
    const enabledIdx = b.indexOf('enabled');
    const welcomeIdx = b.indexOf('welcome_message');
    const supervisorIdx = b.indexOf('supervisor_user_id');
    const managerIdx = b.indexOf('manager_user_id');
    expect(welcomeIdx).toBeGreaterThan(enabledIdx);
    expect(managerIdx).toBeGreaterThan(supervisorIdx);
  });

  it('updated_by comes after created_at/updated_at (not before)', () => {
    const b = block();
    const createdAtIdx = b.indexOf('created_at');
    const updatedAtIdx = b.indexOf('updated_at');
    const updatedByIdx = b.indexOf('updated_by');
    expect(updatedAtIdx).toBeGreaterThan(createdAtIdx);
    expect(updatedByIdx).toBeGreaterThan(updatedAtIdx);
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

  it('recreates RLS + the tenant_isolation policy (role public, kept as it was) and has an honest down()', () => {
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/CREATE POLICY tenant_isolation ON musicchat_automation_settings\s*\n\s*AS PERMISSIVE FOR ALL TO public/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc.match(/count mismatch/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
