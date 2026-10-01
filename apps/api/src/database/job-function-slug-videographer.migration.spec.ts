import { RenameVideomakerJobFunctionSlugToVideographer20260930000033 as Migration } from './migrations/20260930000033_RenameVideomakerJobFunctionSlugToVideographer';

function runner() {
  const sql: string[] = [];
  return {
    sql,
    query: jest.fn(async (text: string) => {
      sql.push(text);
      if (text.includes('pg_roles')) return [{ bypass: true }];
      return [];
    }),
  };
}

describe('RenameVideomakerJobFunctionSlugToVideographer20260930000033', () => {
  it('renames only the seeded live row and never collides with an existing target slug', async () => {
    const q = runner();
    await new Migration().up(q as never);
    const update = q.sql.find((s) => s.includes('UPDATE "job_functions"')) ?? '';
    expect(update).toContain(`SET "slug" = 'videographer'`);
    expect(update).toContain(`t."slug" = 'videomaker'`);
    expect(update).toContain(`t."name" = 'Videomaker'`);
    expect(update).toContain('t."deleted_at" IS NULL');
    expect(update).toContain('NOT EXISTS');
  });

  it('down() reverses under the same guards', async () => {
    const q = runner();
    await new Migration().down(q as never);
    const update = q.sql.find((s) => s.includes('UPDATE "job_functions"')) ?? '';
    expect(update).toContain(`SET "slug" = 'videomaker'`);
    expect(update).toContain(`t."slug" = 'videographer'`);
    expect(update).toContain('NOT EXISTS');
  });
});
