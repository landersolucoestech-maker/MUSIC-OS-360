import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateClientDto, UpdateClientDto } from './dto/clients.dto';
import { ClientsService } from './clients.service';
import { canonicalizeClientInput, canonicalizeClientQuery } from './client-legacy-fields';

/**
 * CZ-043: the client (CRM contact) contract is snake_case English = columns.
 * A pre-CZ-043 web build sends camelCase keys plus a Portuguese
 * "payloadOperacional" copy of the form inside metadata (including plaintext
 * cpf/cnpj) — mapped to the columns, never persisted in metadata again.
 */
const LEGACY_WEB_CREATE = {
  name: 'Maria Produtora',
  type: 'company',
  category: 'PARTNER',
  email: 'maria@x.com',
  phone: '+55 11 90000-0000',
  document: '12.345.678/0001-00',
  zipCode: '01000-000',
  responsible: 'Operações',
  priority: 'high',
  metadata: {
    tipo_pessoa: 'pessoa_juridica', perfil: 'produtora', cnpj: '12.345.678/0001-00', razao_social: 'Maria LTDA',
    nome_fantasia: 'Maria Prod', funcao: 'Diretora', logradouro: 'Rua A', numero: '10', bairro: 'Centro',
    responsavel_email: 'ops@x.com', interacoes: [{ id: 'i1', type: 'ligacao', data: '2026-09-01', horario: '10:00', descricao: 'Oi' }],
    origem: 'evento',
  },
};

function makeService(rows: Record<string, unknown>[] = []) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['where', 'andWhere', 'orderBy', 'skip', 'take']) qb[m] = jest.fn(() => qb);
  qb['getOne'] = jest.fn(async () => rows[0] ?? null);
  qb['getManyAndCount'] = jest.fn(async () => [rows, rows.length]);
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((data: unknown) => ({ ...(data as object) })),
    save: jest.fn(async (entity: unknown) => ({ id: 'c1', ...(entity as object) })),
    update: jest.fn(async () => ({ affected: 1 })),
  };
  const enc = {
    encryptNullable: jest.fn((v: string | null | undefined) => (v == null ? null : `enc:${v}`)),
    decryptNullable: jest.fn((v: string | null | undefined) => (v ? v.replace(/^enc:/, '') : null)),
  };
  return { svc: new ClientsService({ getRepository: () => repo } as never, enc as never), repo, qb };
}

describe('Client request/response contract (CZ-043)', () => {
  it('the pre-CZ-043 web payload still validates (deprecated keys declared)', () => {
    const errors = validateSync(plainToInstance(CreateClientDto, LEGACY_WEB_CREATE), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors).toEqual([]);
  });

  it('create() persists the legacy payload into the canonical columns; metadata keeps no form copy and no plaintext document', async () => {
    const { svc, repo } = makeService();
    await svc.create('t1', 'u1', LEGACY_WEB_CREATE as never);
    const saved = repo.save.mock.calls[0][0] as Record<string, unknown>;
    expect(saved).toMatchObject({
      name: 'Maria Produtora', person_type: 'company', category: 'PARTNER', profile: 'produtora',
      legal_name: 'Maria LTDA', trade_name: 'Maria Prod', job_title: 'Diretora', street: 'Rua A', street_number: '10',
      neighborhood: 'Centro', zip_code: '01000-000', responsible_name: 'Operações', responsible_email: 'ops@x.com',
      priority: 'high', cpf_cnpj_encrypted: 'enc:12.345.678/0001-00',
    });
    expect(saved['interactions']).toEqual([{ id: 'i1', type: 'call', date: '2026-09-01', time: '10:00', description: 'Oi' }]);
    expect(saved['metadata']).toEqual({ origem: 'evento' });
    expect(JSON.stringify(saved)).not.toContain('"cnpj"');
  });

  it('the plaintext cpf in metadata becomes the encrypted document when no document is sent', () => {
    const out = canonicalizeClientInput({ name: 'A', metadata: { cpf: '111.222.333-44', tipo_pessoa: 'pessoa_fisica' } }) as Record<string, unknown>;
    expect(out).toMatchObject({ cpf_cnpj: '111.222.333-44', person_type: 'individual', metadata: {} });
  });

  it('the response carries the canonical columns and decrypted PII, never metadata or ciphertext', async () => {
    const { svc } = makeService([{
      id: 'c1', tenant_id: 't1', name: 'Bob', person_type: 'individual', email_encrypted: 'enc:b@x.com',
      phone_encrypted: null, cpf_cnpj_encrypted: 'enc:123', metadata: { cpf: '123', razao_social: 'Old' },
    }]);
    const row = await svc.findById('t1', 'c1') as Record<string, unknown>;
    expect(row).toMatchObject({ name: 'Bob', person_type: 'individual', email: 'b@x.com', phone: null, cpf_cnpj: '123' });
    for (const key of ['metadata', 'email_encrypted', 'phone_encrypted', 'cpf_cnpj_encrypted', 'nome', 'tipo_pessoa']) {
      expect(row).not.toHaveProperty(key);
    }
  });

  it('an EDIT from a pre-CZ-043 build never overwrites what it could not read (type/priority/status defaults)', () => {
    const oldBuildEdit = { name: 'Novo', type: 'company', priority: 'medium', status: 'active', zipCode: '', metadata: { tipo_pessoa: 'pessoa_juridica', interacoes: [] } };
    expect(canonicalizeClientInput(oldBuildEdit, { update: true })).toEqual({ name: 'Novo', metadata: {} });
    // A canonical (new web) edit keeps every value it sends.
    expect(canonicalizeClientInput({ priority: 'medium', status: 'active' }, { update: true })).toEqual({ priority: 'medium', status: 'active' });
  });

  it("rejects the status 'blocked' the database CHECK never allowed, and unknown interaction types", () => {
    expect(validateSync(plainToInstance(UpdateClientDto, { status: 'blocked' })).length).toBeGreaterThan(0);
    expect(validateSync(plainToInstance(CreateClientDto, { name: 'x', interactions: [{ type: 'ligacao' }] })).length).toBeGreaterThan(0);
  });

  it('maps the legacy query type person/company to person_type', async () => {
    expect(canonicalizeClientQuery({ type: 'person' })).toEqual({ person_type: 'individual' });
    const { svc, qb } = makeService();
    await svc.list('t1', { type: 'company' } as never);
    expect(qb['andWhere']).toHaveBeenCalledWith('c.person_type = :personType', { personType: 'company' });
  });
});
