import { fetchProjectTracksForExport, insertProjectTracksForImport } from './project-tracks.field';

describe('project-tracks.field — repeating group "Músicas do Projeto"', () => {
  describe('fetchProjectTracksForExport', () => {
    it('empty list of projectIds → does not query the database, returns an empty map', async () => {
      const query = jest.fn();
      const ds = { query } as any;
      const result = await fetchProjectTracksForExport(ds, 'tenant-1', []);
      expect(query).not.toHaveBeenCalled();
      expect(result.size).toBe(0);
    });

    it('groups tracks by project and participants by role, isolated by tenant_id', async () => {
      const tracks = [
        {
          id: 'track-1', project_id: 'proj-1', name: 'Faixa 1', solo_feat: 'solo',
          original_remix: 'original', instrumental: 'nao', duration_minutes: '3', duration_seconds: '30',
          music_genre: 'pop', language: 'portugues', lyrics: 'la la', audio_url: 'https://x/a.mp3', sort_order: 0,
        },
      ];
      const participants = [
        { project_track_id: 'track-1', name: 'Fulano', role: 'composer' },
        { project_track_id: 'track-1', name: 'Ciclano', role: 'performer' },
        { project_track_id: 'track-1', name: 'Beltrano', role: 'producer' },
      ];
      const query = jest.fn()
        .mockResolvedValueOnce(tracks)
        .mockResolvedValueOnce(participants);
      const ds = { query } as any;

      const result = await fetchProjectTracksForExport(ds, 'tenant-1', ['proj-1']);

      expect(query.mock.calls[0][0]).toContain('"project_tracks"');
      expect(query.mock.calls[0][1]).toEqual(['tenant-1', ['proj-1']]);
      expect(query.mock.calls[1][0]).toContain('"project_track_participants"');
      expect(query.mock.calls[1][1]).toEqual(['tenant-1', ['track-1']]);

      expect(result.get('proj-1')).toEqual([{
        trackName: 'Faixa 1',
        soloFeat: 'solo',
        originalRemix: 'original',
        instrumental: 'nao',
        trackDurationMinutes: '3',
        trackDurationSeconds: '30',
        musicGenre: 'pop',
        trackLanguage: 'portugues',
        composers: ['Fulano'],
        performers: ['Ciclano'],
        producers: ['Beltrano'],
        lyrics: 'la la',
        audioFiles: 'https://x/a.mp3',
        sort_order: 0,
      }]);
    });

    it('project without tracks → does not appear in the map', async () => {
      const query = jest.fn().mockResolvedValueOnce([]);
      const ds = { query } as any;
      const result = await fetchProjectTracksForExport(ds, 'tenant-1', ['empty-project']);
      expect(result.has('empty-project')).toBe(false);
      expect(query).toHaveBeenCalledTimes(1);
    });
  });

  describe('insertProjectTracksForImport', () => {
    function makeQR() {
      const calls: Array<[string, unknown[]]> = [];
      const qr = { query: jest.fn((sql: string, params: unknown[]) => { calls.push([sql, params]); return Promise.resolve([]); }) } as any;
      return { qr, calls };
    }

    it('non-array value → no-op', async () => {
      const { qr, calls } = makeQR();
      await insertProjectTracksForImport(qr, 'tenant-1', 'proj-1', 'não é array');
      expect(calls).toHaveLength(0);
    });

    it('inserts one project_track per track + participants per role, tenant forced', async () => {
      const { qr, calls } = makeQR();
      const trackRows = [{
        trackName: 'Faixa importada',
        soloFeat: 'feat',
        originalRemix: 'remix',
        instrumental: 'sim',
        trackDurationMinutes: '4',
        trackDurationSeconds: '12',
        musicGenre: 'rock',
        trackLanguage: 'ingles',
        lyrics: '',
        audioFiles: '',
        composers: ['A', ''],
        performers: ['B'],
        producers: [],
      }];
      await insertProjectTracksForImport(qr, 'tenant-1', 'new-project', trackRows);

      const trackInsert = calls.find(([sql]) => sql.includes('"project_tracks"'));
      expect(trackInsert).toBeDefined();
      expect(trackInsert![1]).toEqual(
        expect.arrayContaining(['tenant-1', 'new-project', 'Faixa importada', 'feat', 'remix', 'sim', '4', '12', 'rock', 'ingles']),
      );

      const participantInserts = calls.filter(([sql]) => sql.includes('"project_track_participants"'));
      expect(participantInserts).toHaveLength(2);
      expect(participantInserts.map(([, params]) => params[3])).toEqual(['A', 'B']);
      expect(participantInserts.map(([, params]) => params[4])).toEqual(['composer', 'performer']);
      for (const [, params] of participantInserts) expect(params[1]).toBe('tenant-1');
    });

    it('invalid item is ignored and a valid canonical item is inserted', async () => {
      const { qr, calls } = makeQR();
      await insertProjectTracksForImport(qr, 'tenant-1', 'proj-1', [
        null,
        'string',
        42,
        { trackName: 'Válida' },
      ]);
      const trackInserts = calls.filter(([sql]) => sql.includes('"project_tracks"'));
      expect(trackInserts).toHaveLength(1);
    });
  });
});
