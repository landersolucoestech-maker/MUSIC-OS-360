import { fetchProjectsMusicasForExport, insertProjectsMusicasForImport } from './projects-musicas.field';

describe('projects-musicas.field — grupo repetível "Músicas do Projeto"', () => {
  describe('fetchProjectsMusicasForExport', () => {
    it('lista vazia de projectIds → não consulta o banco, retorna mapa vazio', async () => {
      const query = jest.fn();
      const ds = { query } as any;
      const result = await fetchProjectsMusicasForExport(ds, 'tenant-1', []);
      expect(query).not.toHaveBeenCalled();
      expect(result.size).toBe(0);
    });

    it('agrupa faixas por projeto e participantes por papel, isolado por tenant_id', async () => {
      const tracks = [
        {
          id: 'track-1', project_id: 'proj-1', nome: 'Faixa 1', solo_feat: 'solo',
          original_remix: 'original', instrumental: 'nao', duracao_min: '3', duracao_seg: '30',
          genero: 'pop', idioma: 'portugues', letra: 'la la', audio_url: 'https://x/a.mp3', sort_order: 0,
        },
      ];
      const participants = [
        { project_track_id: 'track-1', nome: 'Fulano', role: 'compositor' },
        { project_track_id: 'track-1', nome: 'Ciclano', role: 'interprete' },
        { project_track_id: 'track-1', nome: 'Beltrano', role: 'produtor' },
      ];
      const query = jest.fn()
        .mockResolvedValueOnce(tracks)
        .mockResolvedValueOnce(participants);
      const ds = { query } as any;

      const result = await fetchProjectsMusicasForExport(ds, 'tenant-1', ['proj-1']);

      expect(query.mock.calls[0][0]).toContain('"project_tracks"');
      expect(query.mock.calls[0][1]).toEqual(['tenant-1', ['proj-1']]);
      expect(query.mock.calls[1][0]).toContain('"project_track_participants"');
      expect(query.mock.calls[1][1]).toEqual(['tenant-1', ['track-1']]);

      expect(result.get('proj-1')).toEqual([{
        nome_musica: 'Faixa 1',
        soloFeat: 'solo',
        originalRemix: 'original',
        instrumental: 'nao',
        duracaoMinutos: '3',
        duracaoSegundos: '30',
        generoMusical: 'pop',
        idiomaMusica: 'portugues',
        compositores: ['Fulano'],
        interpretes: ['Ciclano'],
        produtores: ['Beltrano'],
        letra: 'la la',
        arquivosAudio: 'https://x/a.mp3',
        sort_order: 0,
      }]);
    });

    it('projeto sem faixas → não aparece no mapa', async () => {
      const query = jest.fn().mockResolvedValueOnce([]);
      const ds = { query } as any;
      const result = await fetchProjectsMusicasForExport(ds, 'tenant-1', ['proj-vazio']);
      expect(result.has('proj-vazio')).toBe(false);
      expect(query).toHaveBeenCalledTimes(1);
    });
  });

  describe('insertProjectsMusicasForImport', () => {
    function makeQR() {
      const calls: Array<[string, unknown[]]> = [];
      const qr = { query: jest.fn((sql: string, params: unknown[]) => { calls.push([sql, params]); return Promise.resolve([]); }) } as any;
      return { qr, calls };
    }

    it('valor não-array → no-op', async () => {
      const { qr, calls } = makeQR();
      await insertProjectsMusicasForImport(qr, 'tenant-1', 'proj-1', 'não é array');
      expect(calls).toHaveLength(0);
    });

    it('insere uma project_track por música + participantes por papel, tenant forçado', async () => {
      const { qr, calls } = makeQR();
      const musicas = [{
        nome_musica: 'Faixa importada',
        soloFeat: 'feat',
        originalRemix: 'remix',
        instrumental: 'sim',
        duracaoMinutos: '4',
        duracaoSegundos: '12',
        generoMusical: 'rock',
        idiomaMusica: 'ingles',
        letra: '',
        arquivosAudio: '',
        compositores: ['A', ''],
        interpretes: ['B'],
        produtores: [],
      }];
      await insertProjectsMusicasForImport(qr, 'tenant-1', 'proj-novo', musicas);

      const trackInsert = calls.find(([sql]) => sql.includes('"project_tracks"'));
      expect(trackInsert).toBeDefined();
      expect(trackInsert![1]).toEqual(
        expect.arrayContaining(['tenant-1', 'proj-novo', 'Faixa importada', 'feat', 'remix', 'sim', '4', '12', 'rock', 'ingles']),
      );

      const participantInserts = calls.filter(([sql]) => sql.includes('"project_track_participants"'));
      expect(participantInserts).toHaveLength(2);
      expect(participantInserts.map(([, params]) => params[3])).toEqual(['A', 'B']);
      expect(participantInserts.map(([, params]) => params[4])).toEqual(['compositor', 'interprete']);
      for (const [, params] of participantInserts) expect(params[1]).toBe('tenant-1');
    });

    it('item inválido é ignorado e item canônico válido é inserido', async () => {
      const { qr, calls } = makeQR();
      await insertProjectsMusicasForImport(qr, 'tenant-1', 'proj-1', [
        null,
        'string',
        42,
        { nome_musica: 'Válida' },
      ]);
      const trackInserts = calls.filter(([sql]) => sql.includes('"project_tracks"'));
      expect(trackInserts).toHaveLength(1);
    });
  });
});
