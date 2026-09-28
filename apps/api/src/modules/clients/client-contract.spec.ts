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
    // Its stripped payloadOperacional is empty: metadata is not sent at all (CT-D3).
    expect(canonicalizeClientInput(oldBuildEdit, { update: true })).toEqual({ name: 'Novo' });
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

  it('an old-build EDIT never wipes the stored metadata; a canonical metadata edit is merged (CT-D3)', async () => {
    const stored = { leadId: 'lead-1', convertedAt: '2026-09-01', cpf: '111.222.333-44' };
    const { svc, repo } = makeService([{ id: 'c1', tenant_id: 't1', name: 'Bob', metadata: stored }]);
    await svc.update('t1', 'u1', 'c1', {
      name: 'Bob', type: 'company', metadata: { tipo_pessoa: 'pessoa_juridica', cpf: '', cnpj: '', razao_social: '', interacoes: [] },
    } as never);
    const firstUpdate = (repo.update.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(firstUpdate).not.toHaveProperty('metadata');

    await svc.update('t1', 'u1', 'c1', { metadata: { origin: 'event', EMAIL: 'x@y.com' } } as never);
    const secondUpdate = (repo.update.mock.calls[1] as unknown[])[1] as Record<string, unknown>;
    expect(secondUpdate['metadata']).toEqual({ ...stored, origin: 'event' });
  });

  it('the payloadOperacional unfold runs only for pre-CZ-043 payloads (SEC-F2)', () => {
    // A canonical payload carrying unknown metadata keys that merely look like columns
    // is not a legacy payload: nothing is unfolded into the typed columns.
    const out = canonicalizeClientInput({ name: 'A', person_type: 'company', metadata: { origem: 'x', profile: 'hack' } }) as Record<string, unknown>;
    expect(out).toEqual({ name: 'A', person_type: 'company', metadata: { origem: 'x', profile: 'hack' } });
  });

  it('every unfolded legacy value is re-validated with the DTO rules; invalid values are dropped, never persisted (SEC-F2)', async () => {
    const out = canonicalizeClientInput({
      name: 'A',
      metadata: {
        tipo_pessoa: 'alien',                       // not individual|company after mapping
        perfil: 'p'.repeat(101),                    // profile MaxLength(100)
        cep: '0'.repeat(16),                        // zip_code MaxLength(15)
        responsavel_email: 'e'.repeat(151),         // responsible_email MaxLength(150)
        responsavel_telefone: '11 99999-0000',      // valid -> kept
        interacoes: [{ type: 'hack', descricao: 'x' }],
        razao_social: 'ACME LTDA',                  // valid -> kept
      },
    }) as Record<string, unknown>;
    for (const key of ['person_type', 'profile', 'zip_code', 'responsible_email', 'interactions']) expect(out).not.toHaveProperty(key);
    expect(out).toMatchObject({ responsible_phone: '11 99999-0000', legal_name: 'ACME LTDA', metadata: {} });

    const tooLongDescription = canonicalizeClientInput({
      name: 'A', metadata: { interacoes: [{ type: 'ligacao', descricao: 'd'.repeat(2001) }] },
    }) as Record<string, unknown>;
    expect(tooLongDescription).not.toHaveProperty('interactions');
    const okInteraction = canonicalizeClientInput({
      name: 'A', metadata: { tipo_pessoa: 'pessoa_fisica', interacoes: [{ type: 'ligacao', descricao: 'ok' }] },
    }) as Record<string, unknown>;
    expect(okInteraction).toMatchObject({ person_type: 'individual', interactions: [{ type: 'call', description: 'ok' }] });

    // End to end: the invalid values never reach the INSERT (no 500 from a varchar overflow).
    const { svc, repo } = makeService();
    await svc.create('t1', 'u1', { name: 'A', metadata: { tipo_pessoa: 'alien', cep: '0'.repeat(16) } } as never);
    const saved = repo.save.mock.calls[0][0] as Record<string, unknown>;
    expect(saved['person_type']).toBeUndefined();
    expect(saved['zip_code']).toBeUndefined();
  });

  it('plaintext PII keys are stripped from metadata case-insensitively (SEC-F3)', () => {
    const pii = {
      CPF: '1', Cnpj: '2', cpf_cnpj: '3', Documento: '4', document: '5', RG: '6', Email: 'a@b.c', 'E-Mail': 'a@b.c',
      e_mail: 'a@b.c', Telefone: '7', PHONE: '8', celular: '9', Responsavel_Email: 'x@y.z', ' Tipo_Pessoa ': 'pf',
      leadId: 'lead-1',
    };
    const created = canonicalizeClientInput({ name: 'A', metadata: pii }) as Record<string, unknown>;
    expect(created['metadata']).toEqual({ leadId: 'lead-1' });
    const updated = canonicalizeClientInput({ metadata: pii }, { update: true }) as Record<string, unknown>;
    expect(updated['metadata']).toEqual({ leadId: 'lead-1' });
    expect(JSON.stringify(created)).not.toMatch(/a@b\.c|x@y\.z/);
  });
});
