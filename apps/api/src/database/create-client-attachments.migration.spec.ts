import * as fs from 'fs';
import * as path from 'path';
import { isApplicationMigration } from './migration-classification';

/**
 * create-client-attachments.migration.spec.ts  (Part 80)
 *
 * Permanent guard: client_attachments is the real metadata of client
 * attachments (never the binary — only the object key in R2). Confirms that
 * the table follows the same tenant isolation, RLS and grants pattern already
 * established for clients/leads, and that ClientAttachmentEntity (entities.ts)
 * matches the physical columns exactly — the same kind of guard that
 * caught the real segmento/score bugs in Parts 78/79.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260803000001_CreateClientAttachments.ts'),
  'utf8',
);
const entitiesSrc = fs.readFileSync(path.resolve(__dirname, 'entities.ts'), 'utf8');

describe('CreateClientAttachments20260803000001', () => {
  it('is classified as APPLICATION', () => {
    expect(isApplicationMigration('CreateClientAttachments20260803000001')).toBe(true);
  });

  it('has tenant_id, a composite FK to clients(tenant_id, id), and never stores the binary', () => {
    expect(migrationSrc).toMatch(/tenant_id\s+uuid NOT NULL/);
    expect(migrationSrc).toMatch(/FOREIGN KEY \(tenant_id, client_id\) REFERENCES clients \(tenant_id, id\)/);
    expect(migrationSrc).toMatch(/storage_key/);
    expect(migrationSrc).not.toMatch(/bytea|binary_data/);
  });

  it('has FORCE ROW LEVEL SECURITY with tenant_isolation and super_admin_full_access policies', () => {
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/CREATE POLICY tenant_isolation/);
    expect(migrationSrc).toMatch(/CREATE POLICY super_admin_full_access/);
  });

  it('grants explicit privileges to musicos_migrator and musicos_app (defense in depth)', () => {
    expect(migrationSrc).toMatch(/OWNER TO musicos_migrator/);
    expect(migrationSrc).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON client_attachments TO musicos_app/);
  });

  it('down() remove a tabela', () => {
    const downBlock = migrationSrc.split('async down')[1];
    expect(downBlock).toMatch(/DROP TABLE IF EXISTS client_attachments/);
  });

  it('ClientAttachmentEntity is registered in ALL_ENTITIES', () => {
    expect(entitiesSrc).toMatch(/ClientAttachmentEntity,/);
  });

  it('ClientAttachmentEntity maps exactly the migration\'s physical columns', () => {
    const block = migrationSrc.split('CREATE TABLE client_attachments (')[1].split(')\n    `)')[0];
    const migCols = [...block.matchAll(/^\s*([a-z_]+)\s+\w/gm)].map((m) => m[1]).filter((c) => c !== 'CONSTRAINT');

    const start = entitiesSrc.indexOf('export class ClientAttachmentEntity');
    const end = entitiesSrc.indexOf('\n}', start);
    const entBlock = entitiesSrc.slice(start, end);
    const entCols = [...entBlock.matchAll(/\)\s*([A-Za-z_]+):\s/g)].map((m) => m[1]);

    for (const col of migCols) {
      expect(entCols).toContain(col);
    }
  });

  it('is registered in the migrations index.ts', () => {
    const indexSrc = fs.readFileSync(path.resolve(__dirname, 'migrations/index.ts'), 'utf8');
    expect(indexSrc).toMatch(/CreateClientAttachments20260803000001/);
  });
});
