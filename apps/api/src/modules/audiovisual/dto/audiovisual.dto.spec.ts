/**
 * audiovisual.dto.spec.ts
 *
 * Fase 4 — testes obrigatórios para os DTOs recém-migrados de interface para
 * class-validator (shots/tasks/team-members). Reproduz o ValidationPipe global
 * (whitelist + forbidNonWhitelisted + transform) sem subir a app inteira.
 */
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateShotDto, UpdateShotDto, ReorderShotsDto,
  CreateTaskDto, UpdateTaskDto,
  CreateTeamMemberDto,
  CreateAudiovisualProjectDto,
  TASK_STATUSES,
} from './audiovisual.dto';

async function validatePayload(dto: new () => object, payload: Record<string, unknown>) {
  const instance = plainToInstance(dto, payload);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

describe('CreateShotDto', () => {
  it('aceita um payload válido completo', async () => {
    const errors = await validatePayload(CreateShotDto, {
      scene_title: 'Cena 1', description: 'Abertura', location: 'Estúdio A',
      actors: ['Ator 1'], props: ['guitarra'], wardrobe: ['jaqueta'], equipment: ['câmera RED'],
      estimated_duration_sec: 120, notes: 'nota', ordering: 0,
    });
    expect(errors).toEqual([]);
  });

  it('aceita payload vazio (todos os campos são opcionais)', async () => {
    const errors = await validatePayload(CreateShotDto, {});
    expect(errors).toEqual([]);
  });

  it('rejeita tipo inválido (estimated_duration_sec como string não-numérica)', async () => {
    const errors = await validatePayload(CreateShotDto, { estimated_duration_sec: 'abc' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejeita valor negativo em estimated_duration_sec (@Min(0))', async () => {
    const errors = await validatePayload(CreateShotDto, { estimated_duration_sec: -5 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejeita campo desconhecido (unknown field)', async () => {
    const errors = await validatePayload(CreateShotDto, { scene_title: 'x', campoInventado: 'y' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejeita scene_title excedendo o limite de tamanho', async () => {
    const errors = await validatePayload(CreateShotDto, { scene_title: 'a'.repeat(256) });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('UpdateShotDto', () => {
  it('aceita atualização parcial de um único campo', async () => {
    const errors = await validatePayload(UpdateShotDto, { notes: 'apenas isso' });
    expect(errors).toEqual([]);
  });

  it('rejeita shooting_status fora do enum CAPTURE_STATUSES (invalid enum)', async () => {
    const errors = await validatePayload(UpdateShotDto, { shooting_status: 'nao_existe' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('aceita shooting_status dentro do enum CAPTURE_STATUSES', async () => {
    const errors = await validatePayload(UpdateShotDto, { shooting_status: 'recording' });
    expect(errors).toEqual([]);
  });
});

describe('ReorderShotsDto', () => {
  it('aceita uma lista de UUIDs válidos', async () => {
    const errors = await validatePayload(ReorderShotsDto, {
      ids: ['4b7f2b7e-8b0a-4b4a-9b0a-8b0a4b4a9b0a', '4b7f2b7e-8b0a-4b4a-9b0a-8b0a4b4a9b0b'],
    });
    expect(errors).toEqual([]);
  });

  it('rejeita item não-UUID na lista (invalid UUID)', async () => {
    const errors = await validatePayload(ReorderShotsDto, { ids: ['nao-e-um-uuid'] });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejeita ids ausente (missing required)', async () => {
    const errors = await validatePayload(ReorderShotsDto, {});
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejeita lista excedendo o limite de 500 (exceeded limit)', async () => {
    const ids = Array.from({ length: 501 }, () => '4b7f2b7e-8b0a-4b4a-9b0a-8b0a4b4a9b0a');
    const errors = await validatePayload(ReorderShotsDto, { ids });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('CreateTaskDto / UpdateTaskDto', () => {
  it('aceita um payload válido com todos os campos', async () => {
    const errors = await validatePayload(CreateTaskDto, {
      title: 'Fechar shotlist', description: 'desc', status: 'pending', priority: 'high',
      assigned_to: '4b7f2b7e-8b0a-4b4a-9b0a-8b0a4b4a9b0a', due_date: '2026-08-01',
    });
    expect(errors).toEqual([]);
  });

  it('rejeita title ausente (missing required)', async () => {
    const errors = await validatePayload(CreateTaskDto, { description: 'sem título' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejeita status fora do enum real do banco (invalid enum)', async () => {
    // TASK_STATUSES reflete o CHECK constraint da migration 20260527000004 —
    // 'todo'/'doing' NÃO são valores válidos (ver correção nesta mesma fase).
    const errors = await validatePayload(CreateTaskDto, { title: 'x', status: 'todo' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('TASK_STATUSES corresponde exatamente ao CHECK constraint da tabela audiovisual_tasks', () => {
    expect(TASK_STATUSES).toEqual(['pending', 'in_progress', 'blocked', 'done', 'cancelled']);
  });

  it('rejeita assigned_to que não é UUID (invalid UUID)', async () => {
    const errors = await validatePayload(CreateTaskDto, { title: 'x', assigned_to: 'nao-e-uuid' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('UpdateTaskDto aceita atualização parcial de um único campo', async () => {
    const errors = await validatePayload(UpdateTaskDto, { status: 'done' });
    expect(errors).toEqual([]);
  });

  it('UpdateTaskDto rejeita campos imutáveis não pertencentes ao contrato (id/tenant_id)', async () => {
    const errors = await validatePayload(UpdateTaskDto, {
      status: 'done', id: '4b7f2b7e-8b0a-4b4a-9b0a-8b0a4b4a9b0a', tenant_id: 'x',
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('CreateTeamMemberDto', () => {
  it('aceita um payload válido', async () => {
    const errors = await validatePayload(CreateTeamMemberDto, {
      role: 'camera', external_name: 'Fulano', contact: 'fulano@example.com',
    });
    expect(errors).toEqual([]);
  });

  it('rejeita role ausente (missing required)', async () => {
    const errors = await validatePayload(CreateTeamMemberDto, { external_name: 'Fulano' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejeita role fora do enum TEAM_ROLES reconciliado (invalid enum)', async () => {
    // "videomaker" era o valor divergente do frontend antes da reconciliação
    // desta fase — não existe mais em TEAM_ROLES.
    const errors = await validatePayload(CreateTeamMemberDto, { role: 'videomaker' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejeita user_id que não é UUID (invalid UUID)', async () => {
    const errors = await validatePayload(CreateTeamMemberDto, { role: 'camera', user_id: 'abc' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejeita payment_amount negativo', async () => {
    const errors = await validatePayload(CreateTeamMemberDto, { role: 'camera', payment_amount: -10 });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('CreateAudiovisualProjectDto — regressão do bug real (auditoria 2026-07-18)', () => {
  // Payload exatamente como AudiovisualProjectFormModal.tsx monta e envia
  // hoje (sem nenhum mapper intermediário — audiovisual.service.ts chama
  // api.post/api.patch com o payload cru). Antes desta migration, TODO este
  // payload era rejeitado com 400 (forbidNonWhitelisted) — nenhuma criação ou
  // edição de produção audiovisual funcionava.
  const REAL_FORM_PAYLOAD = {
    phonogram_id: undefined,
    music_title: 'Minha Música',
    artist_name: 'Artista X',
    title: 'Minha Música',
    type: 'music_video',
    format: '16:9',
    director: 'Fulano',
    videomaker: 'Beltrano',
    editor: 'Ciclano',
    shooting_date: '2026-08-01',
    location: 'Estúdio A',
    capture_status: 'scheduled',
    editing_status: 'not_started',
    approval_status: 'pending',
    pre_release_date: '2026-08-10',
    release_date: '2026-08-15',
    budget_estimated: 1000,
    budget_actual: 500,
    concept: 'Conceito inicial',
    observations: 'Nenhuma',
    status: 'draft',
    final_status: 'planned',
  };

  it('aceita o payload real do formulário (antes rejeitado inteiro por forbidNonWhitelisted)', async () => {
    const errors = await validatePayload(CreateAudiovisualProjectDto, REAL_FORM_PAYLOAD);
    expect(errors).toEqual([]);
  });

  it('rejeita `music_id`/`budget`/`real_cost`/`name` — não são nomes de coluna reais', async () => {
    for (const key of ['music_id', 'budget', 'real_cost', 'name']) {
      const errors = await validatePayload(CreateAudiovisualProjectDto, { ...REAL_FORM_PAYLOAD, [key]: 'x' });
      expect(errors.some((e) => e.property === key)).toBe(true);
    }
  });

  it('rejeita capture_status maior que 30 caracteres (coluna varchar(30))', async () => {
    const errors = await validatePayload(CreateAudiovisualProjectDto, { ...REAL_FORM_PAYLOAD, capture_status: 'x'.repeat(31) });
    expect(errors.some((e) => e.property === 'capture_status')).toBe(true);
  });
});
