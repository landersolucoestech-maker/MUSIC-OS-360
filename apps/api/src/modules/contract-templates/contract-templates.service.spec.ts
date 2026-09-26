/**
 * contract-templates.service.spec.ts
 *
 * Task U — proves that the form's real contract (name/tipo_servico/
 * conteudo/active/description/variables_manifest/header_image/footer_image)
 * persists 1:1 into the physical columns. Before this fix, the DTO used English
 * keys (title/type/content/variables/metadata) that were never sent by the
 * only real form (ContractImportWorkspace.tsx) — every template create/edit
 * returned 400 (forbidNonWhitelisted).
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

describe("ContractTemplatesService — the form's real contract (Task U)", () => {
  it('create: persists name/tipo_servico/conteudo/active exactly as sent', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', 'user-1', {
      name: 'Template Exclusividade', tipo_servico: 'semantico', conteudo: '{{NOME}}', active: true,
    } as unknown as CreateContractTemplateDto);

    const row = created(repo);
    expect(row['name']).toBe('Template Exclusividade');
    expect(row['tipo_servico']).toBe('semantico');
    expect(row['conteudo']).toBe('{{NOME}}');
    expect(row['active']).toBe(true);
    expect(row['tenant_id']).toBe('tenant-1');
  });

  it('create: persists description/variables_manifest/header_image/footer_image', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', 'user-1', {
      name: 'X', conteudo: 'Y',
      description: '3 variáveis',
      variables_manifest: '{"variables":["{{NOME}}"]}',
      header_image: 'data:image/png;base64,abc',
      footer_image: null,
    } as unknown as CreateContractTemplateDto);

    const row = created(repo);
    expect(row['description']).toBe('3 variáveis');
    expect(row['variables_manifest']).toBe('{"variables":["{{NOME}}"]}');
    expect(row['header_image']).toBe('data:image/png;base64,abc');
    expect(row['footer_image']).toBeNull();
  });

  it('update: scopes by tenant and writes the form fields', async () => {
    const { svc, repo } = makeService();
    await svc.update('tenant-1', 'template-1', {
      name: 'Renomeado', active: false,
    } as unknown as UpdateContractTemplateDto);

    const [criteria, row] = (repo.update as jest.Mock).mock.calls[0];
    expect(criteria).toEqual({ id: 'template-1', tenant_id: 'tenant-1' });
    expect(row['name']).toBe('Renomeado');
    expect(row['active']).toBe(false);
  });

  it('update: never writes the old English keys (title/type/content/variables/metadata)', async () => {
    const { svc, repo } = makeService();
    await svc.update('tenant-1', 'template-1', { name: 'X' } as unknown as UpdateContractTemplateDto);

    const row = updated(repo);
    expect(row['title']).toBeUndefined();
    expect(row['type']).toBeUndefined();
    expect(row['content']).toBeUndefined();
    expect(row['variables']).toBeUndefined();
    expect(row['metadata']).toBeUndefined();
  });
});

/**
 * Task W — CAS/expectedUpdatedAt in Contract Templates (item 1 of AFTER):
 * update() previously overwrote unconditionally. Same pattern as
 * shares/finance-category-rules — without expectedUpdatedAt, behavior
 * identical to before; with a stale one, 409 instead of silently losing the
 * concurrent edit.
 */
describe('ContractTemplatesService — optimistic concurrency (Task W)', () => {
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

  it('without expectedUpdatedAt: applies an unconditional update (backward compatibility)', async () => {
    const { svc, repo } = makeCasService();
    await svc.update('tenant-1', 'template-1', { name: 'Novo nome' } as unknown as UpdateContractTemplateDto);

    const [criteria] = (repo.update as jest.Mock).mock.calls[0];
    expect(criteria).toEqual({ id: 'template-1', tenant_id: 'tenant-1' });
  });

  it('with correct expectedUpdatedAt: includes updated_at in the UPDATE criteria', async () => {
    const { svc, repo } = makeCasService();
    await svc.update('tenant-1', 'template-1', {
      name: 'Novo nome',
      expectedUpdatedAt: NOW.toISOString(),
    } as unknown as UpdateContractTemplateDto);

    const [criteria] = (repo.update as jest.Mock).mock.calls[0];
    expect(criteria.id).toBe('template-1');
    expect(criteria.tenant_id).toBe('tenant-1');
    // Task X — updated_at is no longer an exact equality (a timestamp without tz
    // loses precision in the Date/JSON round-trip); it is now Raw() truncated to
    // milliseconds — see optimistic-update.util.ts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const op = criteria.updated_at as any;
    expect(op._type).toBe('raw');
    expect(op._objectLiteralParameters).toEqual({ expected: NOW });
  });

  it('with a stale expectedUpdatedAt (0 rows affected): throws ConflictException, does not overwrite', async () => {
    const { svc } = makeCasService({ affected: 0 });

    await expect(
      svc.update('tenant-1', 'template-1', {
        name: 'Edição concorrente',
        expectedUpdatedAt: new Date('2026-08-16T11:00:00.000Z').toISOString(),
      } as unknown as UpdateContractTemplateDto),
    ).rejects.toThrow(ConflictException);
  });

  it('expectedUpdatedAt is never persisted as a column', async () => {
    const { svc, repo } = makeCasService();
    await svc.update('tenant-1', 'template-1', {
      name: 'X',
      expectedUpdatedAt: NOW.toISOString(),
    } as unknown as UpdateContractTemplateDto);

    const [, row] = (repo.update as jest.Mock).mock.calls[0];
    expect(row['expectedUpdatedAt']).toBeUndefined();
  });
});
