import 'reflect-metadata';
import { SocietyPayloadBuilderService } from './society-payload-builder.service';
import { WorkEntity, PhonogramEntity, ShareEntity, ExternalIdentifierEntity } from '../../../database/entities';

function repo(rows: Record<string, unknown>[]) {
  return {
    findOne: jest.fn(async (o: { where: Record<string, unknown> }) => rows.find((r) => r['id'] === o.where['id']) ?? null),
    find: jest.fn(async () => rows),
  };
}
function ds(shares: Record<string, unknown>[]) {
  const map = new Map<unknown, unknown>([
    [WorkEntity, repo([{ id: 'w1', tenant_id: 't1', title: 'Obra', deleted_at: null, alternative_titles: [], ai_tools: [], ai_prompts: [] }])],
    [PhonogramEntity, repo([])],
    [ShareEntity, repo(shares)],
    [ExternalIdentifierEntity, repo([])],
  ]);
  return { getRepository: (e: unknown) => map.get(e) } as never;
}
const sh = (id: string, name: string, role: string) =>
  ({ id, share_type: null, deleted_at: null, holder_name: name, percentage: '25', party_role: role });

describe('society payload legacy publisher role (legacy in, canonical out)', () => {
  it.each([['editora'], ['Editora Musical'], ['editor'], ['publisher']])('role "%s" is placed under publishers', async (role) => {
    const svc = new SocietyPayloadBuilderService(ds([sh('a', 'Autor', 'author'), sh('p', 'Pub', role)]));
    const payload = await svc.buildWorkPayload('t1', 'w1');
    expect(payload.publishers.map((p) => p.name)).toEqual(['Pub']);
    expect(payload.authors.map((p) => p.name)).toEqual(['Autor']);
  });
});
