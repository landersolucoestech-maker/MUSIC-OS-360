import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProjectDto } from './projects.dto';

/**
 * projects.dto.spec.ts
 *
 * Guarda permanente (auditoria 2026-07-18 — bug real confirmado): o DTO
 * antigo usava nomes em inglês (type/artistId/budget/currency/
 * startsAt/deadlineAt/releasedAt) que NUNCA batiam com o payload real
 * enviado por ProjetoFormModal.tsx/Projetos.tsx (title/type/status/
 * observacoes/description/genero/artist_id/musicas[]) nem com as colunas
 * físicas da entity (title/type/status/description). Com
 * ValidationPipe (whitelist + forbidNonWhitelisted), toda criação/edição de
 * projeto retornava 400. `title` passou de nome legado a canônico na
 * normalização de nomenclatura (2026-09-05).
 */
async function validatePayload(payload: Record<string, unknown>) {
  const instance = plainToInstance(CreateProjectDto, payload);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

const REAL_FORM_PAYLOAD = {
  title: 'Meu Álbum',
  type: 'album',
  observacoes: 'Notas internas',
  description: null,
  genero: 'pop',
  artist_id: '123e4567-e89b-12d3-a456-426614174000',
  musicas: [
    {
      id: 'faixa-1', nome: 'Faixa 1', soloFeat: 'solo', originalRemix: 'original',
      instrumental: 'nao', duracaoMin: '3', duracaoSeg: '30', genero: 'pop', idioma: 'pt-BR',
      compositores: ['Fulano'], interpretes: ['Beltrano'], produtores: ['Ciclano'], letra: 'lalala',
    },
  ],
};

describe('CreateProjectDto — contrato canônico real (auditoria 2026-07-18)', () => {
  it('aceita o payload real do formulário (antes rejeitado inteiro por forbidNonWhitelisted)', async () => {
    const errors = await validatePayload(REAL_FORM_PAYLOAD);
    expect(errors).toEqual([]);
  });

  it('rejeita os nomes em inglês do DTO antigo (type/artistId/budget/currency/startsAt/deadlineAt/releasedAt) — "title" passou a canônico em 2026-09-05', async () => {
    for (const key of ['type', 'artistId', 'budget', 'currency', 'startsAt', 'deadlineAt', 'releasedAt']) {
      const errors = await validatePayload({ ...REAL_FORM_PAYLOAD, [key]: 'x' });
      expect(errors.some((e) => e.property === key)).toBe(true);
    }
  });

  it('aceita payload mínimo (apenas title/type obrigatórios)', async () => {
    const errors = await validatePayload({ title: 'X', type: 'single' });
    expect(errors).toEqual([]);
  });

  it('rejeita type fora do enum real', async () => {
    const errors = await validatePayload({ title: 'X', type: 'inexistente' });
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });
});
