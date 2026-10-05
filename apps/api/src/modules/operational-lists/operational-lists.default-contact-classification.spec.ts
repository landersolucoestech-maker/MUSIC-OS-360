import 'reflect-metadata';
import { OperationalListsService } from './operational-lists.service';

/**
 * Behavioral proof of the platform default slug `VIDEOMAKER` (operational-lists.defaults.ts, kind
 * contact_individual_classification). A tenant with no operational-list item receives the defaults on first read; the slug is
 * persisted verbatim as the row's `slug` and as the tail of its stable key. The service's real bootstrap runs; only the
 * repository (the database) is a recorder of the INSERT values.
 */
function bootstrapRows(): Array<Record<string, unknown>> {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  for (const m of ['where', 'andWhere', 'orderBy', 'addOrderBy', 'skip', 'take', 'insert', 'into', 'values', 'orIgnore']) qb[m] = jest.fn(chain);
  qb['getManyAndCount'] = jest.fn(async () => [[], 0]);
  qb['execute'] = jest.fn(async () => ({ identifiers: [] }));
  const repo = { count: jest.fn(async () => 0), createQueryBuilder: jest.fn(() => qb) };
  const svc = new OperationalListsService({ getRepository: () => repo } as never);
  return { svc, qb } as never;
}

async function seeded(): Promise<Array<Record<string, unknown>>> {
  const { svc, qb } = bootstrapRows() as unknown as { svc: OperationalListsService; qb: Record<string, jest.Mock> };
  await svc.list('tenant-1', {} as never);
  return qb['values'].mock.calls[0][0] as Array<Record<string, unknown>>;
}

describe('operational list default VIDEOMAKER', () => {
  it('is seeded exactly once, as a contact_individual_classification platform item with the exact slug and stable key', async () => {
    const rows = await seeded();
    const hits = rows.filter((r) => r['slug'] === 'VIDEOMAKER');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      tenant_id: 'tenant-1',
      kind: 'contact_individual_classification',
      slug: 'VIDEOMAKER',
      name: 'Videomaker',
      origin: 'platform',
      active: true,
      group: 'Pessoa Física',
      stable_key: 'contact_individual_classification.videomaker',
    });
  });

  it('negative: no near-miss spelling of the slug is seeded, and the legacy kind (contact_pf_classification) is not written', async () => {
    const rows = await seeded();
    const slugs = rows.filter((r) => r['kind'] === 'contact_individual_classification').map((r) => r['slug']);
    expect(slugs).toContain('VIDEOMAKER');
    for (const near of ['videomaker', 'VIDEO_MAKER', 'VideoMaker', 'VIDEOMAKERS', 'VIDEOMAKE', 'CINEGRAFISTA']) expect(slugs).not.toContain(near);
    expect(rows.some((r) => r['kind'] === 'contact_pf_classification')).toBe(false);
    expect(rows.filter((r) => r['stable_key'] === 'contact_individual_classification.videomaker')).toHaveLength(1);
  });
});
