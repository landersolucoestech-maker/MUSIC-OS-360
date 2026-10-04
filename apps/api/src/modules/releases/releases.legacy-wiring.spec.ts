import 'reflect-metadata';
import { ReleasesService } from './releases.service';

/** list(type) must map a legacy type filter (old clients/bookmarks) to the canonical stored value. */
describe('ReleasesService.list legacy type filter wiring', () => {
  function build() {
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['leftJoinAndMapOne', 'select', 'where', 'andWhere', 'orderBy', 'skip', 'take']) qb[m] = jest.fn(() => qb);
    qb['getManyAndCount'] = jest.fn(async () => [[], 0]);
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    const svc = new ReleasesService({ getRepository: () => repo } as never, {} as never, { emitTyped: jest.fn() } as never);
    return { svc, qb };
  }

  it.each([
    ['compilacao', 'compilation'],
    ['clipe', 'video'],
    ['videoclipe', 'video'],
    ['LP', 'album'],
    ['single', 'single'],
    ['totally-unknown', 'totally-unknown'],
  ])('list(type=%s) filters r.type = %s', async (legacy, canonical) => {
    const { svc, qb } = build();
    await svc.list('t1', { type: legacy } as never);
    expect(qb['andWhere']).toHaveBeenCalledWith('r.type = :type', { type: canonical });
  });
});
