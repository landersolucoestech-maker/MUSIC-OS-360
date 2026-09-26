import { AddEventsStartsAt20260716000001 } from './migrations/20260716000001_AddEventsStartsAt';

describe('AddEventsStartsAt20260716000001 (C3/E1 — expansion)', () => {
  function queryRunner() {
    return { query: jest.fn(async (_sql: string) => undefined) };
  }

  it('up: adds a nullable starts_at timestamp without default, plus the composite tenant/starts_at index', async () => {
    const qr = queryRunner();
    await new AddEventsStartsAt20260716000001().up(qr as never);
    const sql = qr.query.mock.calls.map(([statement]) => statement).join('\n');

    expect(sql).toContain('ALTER TABLE "events"');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "starts_at" timestamp');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_events_tenant_starts_at"');
    expect(sql).toContain('ON "events" ("tenant_id", "starts_at")');

    // Nullable nesta fase: nenhum NOT NULL, nenhum default, nenhuma cópia de dados.
    expect(sql).not.toMatch(/NOT NULL/i);
    expect(sql).not.toMatch(/DEFAULT/i);
    expect(sql).not.toMatch(/UPDATE\s+"?events"?/i);
    // data permanece intocada: nenhum DROP/RENAME/ALTER da coluna legada.
    expect(sql).not.toMatch(/DROP COLUMN\s+"?data"?/i);
    expect(sql).not.toMatch(/RENAME/i);
    expect(sql).not.toMatch(/ALTER COLUMN\s+"?data"?/i);
    // nenhum trigger e nenhuma outra tabela.
    expect(sql).not.toMatch(/TRIGGER/i);
    expect(sql.match(/ALTER TABLE "(\w+)"/g)).toEqual(['ALTER TABLE "events"']);
    // índice antigo não é tocado.
    expect(sql).not.toContain('idx_events_tenant_data');
  });

  it('down: drops only the new index and the starts_at column, preserving data', async () => {
    const qr = queryRunner();
    await new AddEventsStartsAt20260716000001().down(qr as never);
    const sql = qr.query.mock.calls.map(([statement]) => statement).join('\n');

    expect(sql).toContain('DROP INDEX IF EXISTS "idx_events_tenant_starts_at"');
    expect(sql).toContain('ALTER TABLE "events" DROP COLUMN IF EXISTS "starts_at"');
    expect(sql).not.toMatch(/DROP COLUMN\s+(IF EXISTS\s+)?"data"/i);
    expect(sql).not.toContain('idx_events_tenant_data');
    // down não inventa nem copia dados.
    expect(sql).not.toMatch(/UPDATE|INSERT/i);
  });

  it('name follows the codebase TypeORM convention (Class+timestamp)', () => {
    expect(new AddEventsStartsAt20260716000001().name).toBe('AddEventsStartsAt20260716000001');
  });
});
