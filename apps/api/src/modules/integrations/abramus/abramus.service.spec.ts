import { AbramusService } from './abramus.service';

describe('AbramusService.registerWork (adapter boundary)', () => {
  const build = () => {
    const service = new AbramusService(null, {} as never);
    jest.spyOn(service, 'loadCredentials').mockResolvedValue({
      username: 'u', password: 'p', base_url: 'https://abramus.example.test',
    } as never);
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'w1' }) });
    (service as unknown as { fetch: jest.Mock }).fetch = fetchMock;
    return { service, fetchMock };
  };

  it('maps the canonical work to the exact Abramus external body keys', async () => {
    const { service, fetchMock } = build();
    await service.registerWork('tenant-1', {
      title: 'Obra X', composer: 'Fulano', co_composers: ['Beltrano'], iswc: 'T-123',
      genre: 'Pop', duration: '3:20', publisher: 'Editora Y',
    });
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('https://abramus.example.test/api/v1/works');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      title: 'Obra X', compositor: 'Fulano', coautores: ['Beltrano'], iswc: 'T-123',
      genero: 'Pop', duracao: '3:20', editora: 'Editora Y',
    });
    expect(Object.keys(JSON.parse(init.body as string)).sort()).toEqual(
      ['coautores', 'compositor', 'duracao', 'editora', 'genero', 'iswc', 'title'],
    );
  });

  it('never leaks canonical internal names to the external body', async () => {
    const { service, fetchMock } = build();
    await service.registerWork('tenant-1', { title: 'T', composer: 'C', co_composers: ['X'], genre: 'G', duration: 'D', publisher: 'P' });
    const body = JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string);
    for (const k of ['composer', 'co_composers', 'genre', 'duration', 'publisher']) expect(body).not.toHaveProperty(k);
  });
});

describe('AbramusService.getStatements (adapter boundary)', () => {
  const build = () => {
    const service = new AbramusService(null, {} as never);
    jest.spyOn(service, 'loadCredentials').mockResolvedValue({
      username: 'u', password: 'p', base_url: 'https://abramus.example.test',
    } as never);
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([]) });
    (service as unknown as { fetch: jest.Mock }).fetch = fetchMock;
    return { service, fetchMock };
  };

  it('sends the canonical period as the external `periodo` query parameter', async () => {
    const { service, fetchMock } = build();
    await service.getStatements('tenant-1', '2026-01', 5);
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe('https://abramus.example.test/api/v1/statements?limit=5&periodo=2026-01');
  });

  it('omits the period parameter when absent', async () => {
    const { service, fetchMock } = build();
    await service.getStatements('tenant-1', undefined, 20);
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe('https://abramus.example.test/api/v1/statements?limit=20');
  });
});
