/**
 * contract-templates.service.spec.ts
 *
 * Task U — prova que o contrato real do formulário (nome/tipo_servico/
 * conteudo/active/descricao/variables_manifest/header_image/footer_image)
 * persiste 1:1 nas colunas físicas. Antes desta correção, o DTO usava chaves
 * em inglês (title/type/content/variables/metadata) que nunca eram enviadas
 * pelo único formulário real (ContractImportWorkspace.tsx) — toda criação/
 * edição de template retornava 400 (forbidNonWhitelisted).
 */
import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { ContractTemplatesService } from './contract-templates.service';
import type { CreateContractTemplateDto } from './dto/create-contract-template.dto';
import type { UpdateContractTemplateDto } from './dto/update-contract-template.dto';

function makeRepo() {
  return {
    create: jest.fn((data: unknown) => ({ ...(data as object) })),
    save: jest.fn(async (entity: unknown) => ({ id: 'template-new', ...(entity as object) })),
    update: jest.fn(async () => ({ affected: 1 })),
    createQueryBuilder: jest.fn(() => {
      const qb: Record<string, jest.Mock> = {};
      const chain = () => qb;
      qb['where'] = jest.fn(chain);
      qb['andWhere'] = jest.fn(chain);
      qb['getOne'] = jest.fn(async () => ({ id: 'template-1', tenant_id: 'tenant-1' }));
      return qb;
    }),
  };
}

function makeService() {
  const repo = makeRepo();
  const ds = { getRepository: jest.fn(() => repo) } as never;
  const svc = new ContractTemplatesService(ds);
  return { svc, repo };
}

function created(repo: ReturnType<typeof makeRepo>) {
  return (repo.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
}

function updated(repo: ReturnType<typeof makeRepo>) {
  return (repo.update as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
}

describe('ContractTemplatesService — contrato real do formulário (Task U)', () => {
  it('create: persiste nome/tipo_servico/conteudo/active exatamente como enviados', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', 'user-1', {
      nome: 'Template Exclusividade', tipo_servico: 'semantico', conteudo: '{{NOME}}', active: true,
    } as unknown as CreateContractTemplateDto);

    const row = created(repo);
    expect(row['nome']).toBe('Template Exclusividade');
    expect(row['tipo_servico']).toBe('semantico');
    expect(row['conteudo']).toBe('{{NOME}}');
    expect(row['active']).toBe(true);
    expect(row['tenant_id']).toBe('tenant-1');
  });

  it('create: persiste descricao/variables_manifest/header_image/footer_image', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', 'user-1', {
      nome: 'X', conteudo: 'Y',
      descricao: '3 variáveis',
      variables_manifest: '{"variables":["{{NOME}}"]}',
      header_image: 'data:image/png;base64,abc',
      footer_image: null,
    } as unknown as CreateContractTemplateDto);

    const row = created(repo);
    expect(row['descricao']).toBe('3 variáveis');
    expect(row['variables_manifest']).toBe('{"variables":["{{NOME}}"]}');
    expect(row['header_image']).toBe('data:image/png;base64,abc');
    expect(row['footer_image']).toBeNull();
  });

  it('update: escopa por tenant e grava os campos do formulário', async () => {
    const { svc, repo } = makeService();
    await svc.update('tenant-1', 'template-1', {
      nome: 'Renomeado', active: false,
    } as unknown as UpdateContractTemplateDto);

    const [criteria, row] = (repo.update as jest.Mock).mock.calls[0];
    expect(criteria).toEqual({ id: 'template-1', tenant_id: 'tenant-1' });
    expect(row['nome']).toBe('Renomeado');
    expect(row['active']).toBe(false);
  });

  it('update: nunca grava chaves antigas em inglês (title/type/content/variables/metadata)', async () => {
    const { svc, repo } = makeService();
    await svc.update('tenant-1', 'template-1', { nome: 'X' } as unknown as UpdateContractTemplateDto);

    const row = updated(repo);
    expect(row['title']).toBeUndefined();
    expect(row['type']).toBeUndefined();
    expect(row['content']).toBeUndefined();
    expect(row['variables']).toBeUndefined();
    expect(row['metadata']).toBeUndefined();
  });
});

/**
 * Task W — CAS/expectedUpdatedAt em Contract Templates (item 1 do DEPOIS):
 * update() antes sobrescrevia incondicionalmente. Mesmo padrão de
 * shares/finance-category-rules — sem expectedUpdatedAt, comportamento
 * idêntico ao anterior; com ele desatualizado, 409 em vez de perder a edição
 * concorrente silenciosamente.
 */
describe('ContractTemplatesService — concorrência otimista (Task W)', () => {
  const NOW = new Date('2026-08-16T12:00:00.000Z');

  function makeCasRepo(updateResult: { affected: number } = { affected: 1 }) {
    return {
      update: jest.fn(async () => updateResult),
      createQueryBuilder: jest.fn(() => {
        const qb: Record<string, jest.Mock> = {};
        const chain = () => qb;
        qb['where'] = jest.fn(chain);
        qb['andWhere'] = jest.fn(chain);
        qb['getOne'] = jest.fn(async () => ({ id: 'template-1', tenant_id: 'tenant-1', updated_at: NOW }));
        return qb;
      }),
    };
  }

  function makeCasService(updateResult?: { affected: number }) {
    const repo = makeCasRepo(updateResult);
    const ds = { getRepository: jest.fn(() => repo) } as never;
    const svc = new ContractTemplatesService(ds);
    return { svc, repo };
  }

  it('sem expectedUpdatedAt: aplica update incondicional (compatibilidade retroativa)', async () => {
    const { svc, repo } = makeCasService();
    await svc.update('tenant-1', 'template-1', { nome: 'Novo nome' } as unknown as UpdateContractTemplateDto);

    const [criteria] = (repo.update as jest.Mock).mock.calls[0];
    expect(criteria).toEqual({ id: 'template-1', tenant_id: 'tenant-1' });
  });

  it('com expectedUpdatedAt correto: inclui updated_at no critério do UPDATE', async () => {
    const { svc, repo } = makeCasService();
    await svc.update('tenant-1', 'template-1', {
      nome: 'Novo nome',
      expectedUpdatedAt: NOW.toISOString(),
    } as unknown as UpdateContractTemplateDto);

    const [criteria] = (repo.update as jest.Mock).mock.calls[0];
    expect(criteria.id).toBe('template-1');
    expect(criteria.tenant_id).toBe('tenant-1');
    // Task X — updated_at deixou de ser igualdade exata (timestamp sem tz
    // perde precisão no round-trip Date/JSON); agora é Raw() truncado a
    // milissegundos — ver optimistic-update.util.ts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const op = criteria.updated_at as any;
    expect(op._type).toBe('raw');
    expect(op._objectLiteralParameters).toEqual({ expected: NOW });
  });

  it('com expectedUpdatedAt desatualizado (0 linhas afetadas): lança ConflictException, não sobrescreve', async () => {
    const { svc } = makeCasService({ affected: 0 });

    await expect(
      svc.update('tenant-1', 'template-1', {
        nome: 'Edição concorrente',
        expectedUpdatedAt: new Date('2026-08-16T11:00:00.000Z').toISOString(),
      } as unknown as UpdateContractTemplateDto),
    ).rejects.toThrow(ConflictException);
  });

  it('expectedUpdatedAt nunca é persistido como coluna', async () => {
    const { svc, repo } = makeCasService();
    await svc.update('tenant-1', 'template-1', {
      nome: 'X',
      expectedUpdatedAt: NOW.toISOString(),
    } as unknown as UpdateContractTemplateDto);

    const [, row] = (repo.update as jest.Mock).mock.calls[0];
    expect(row['expectedUpdatedAt']).toBeUndefined();
  });
});
