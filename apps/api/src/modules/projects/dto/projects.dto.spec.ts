import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProjectDto } from './projects.dto';

/**
 * projects.dto.spec.ts
 *
 * Permanent guard (2026-07-18 audit — real bug confirmed): the old
 * DTO used English names (type/artistId/budget/currency/
 * startsAt/deadlineAt/releasedAt) that NEVER matched the real payload
 * sent by ProjetoFormModal.tsx/Projetos.tsx (title/type/status/
 * notes/description/music_genre/artist_id/musicas[]) nor the entity's
 * physical columns (title/type/status/description). With
 * ValidationPipe (whitelist + forbidNonWhitelisted), every project
 * create/edit returned 400. `title` went from legacy name to canonical in the
 * naming normalization (2026-09-05).
 */
async function validatePayload(payload: Record<string, unknown>) {
  const instance = plainToInstance(CreateProjectDto, payload);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

const REAL_FORM_PAYLOAD = {
  title: 'Meu Álbum',
  type: 'album',
  notes: 'Notas internas',
  description: null,
  music_genre: 'pop',
  artist_id: '123e4567-e89b-12d3-a456-426614174000',
  musicas: [
    {
      id: 'faixa-1', nome: 'Faixa 1', soloFeat: 'solo', originalRemix: 'original',
      instrumental: 'nao', duracaoMin: '3', duracaoSeg: '30', genero: 'pop', idioma: 'pt-BR',
      compositores: ['Fulano'], interpretes: ['Beltrano'], produtores: ['Ciclano'], letra: 'lalala',
    },
  ],
};

describe('CreateProjectDto — real canonical contract (audit 2026-07-18)', () => {
  it('accepts the real form payload (previously rejected entirely by forbidNonWhitelisted)', async () => {
    const errors = await validatePayload(REAL_FORM_PAYLOAD);
    expect(errors).toEqual([]);
  });

  it('rejects the old DTO\'s English names (type/artistId/budget/currency/startsAt/deadlineAt/releasedAt) — "title" became canonical on 2026-09-05', async () => {
    for (const key of ['type', 'artistId', 'budget', 'currency', 'startsAt', 'deadlineAt', 'releasedAt']) {
      const errors = await validatePayload({ ...REAL_FORM_PAYLOAD, [key]: 'x' });
      expect(errors.some((e) => e.property === key)).toBe(true);
    }
  });

  it('accepts a minimal payload (only title/type required)', async () => {
    const errors = await validatePayload({ title: 'X', type: 'single' });
    expect(errors).toEqual([]);
  });

  it('rejeita type fora do enum real', async () => {
    const errors = await validatePayload({ title: 'X', type: 'inexistente' });
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });
});

describe('CreateProjectDto — artist_id/orcamento (GAP-0001 / DEC-001)', () => {
  it('accepts artist_id and orcamento sent by ProjectFormModal', async () => {
    expect(await validatePayload({ ...REAL_FORM_PAYLOAD, orcamento: 15000.5 })).toEqual([]);
  });

  it('aceita artist_id/orcamento nulos (campos opcionais limpos)', async () => {
    expect(await validatePayload({ ...REAL_FORM_PAYLOAD, artist_id: null, orcamento: null })).toEqual([]);
  });

  it('rejects a negative orcamento on the server (does not rely on the frontend)', async () => {
    const errors = await validatePayload({ ...REAL_FORM_PAYLOAD, orcamento: -1 });
    expect(errors.map((e) => e.property)).toContain('orcamento');
  });
});
