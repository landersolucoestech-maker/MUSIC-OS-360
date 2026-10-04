import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { ArtistsService } from './artists.service';
import { sanitizeArtistMetadataInput } from './artist-input-sanitizer';
import { EncryptionService } from '../../core/security/encryption.service';

/**
 * BLK-CRM-PII-PLAINTEXT (artists): personal/bank data is persisted only as field-level ciphertext, legacy
 * plaintext rows stay readable (dual-read), and no plaintext PII goes into `artists.metadata`.
 * Uses the REAL EncryptionService (no mock of the boundary under test).
 */
const KEY = 'ab'.repeat(32);
const encryption = new EncryptionService({ get: () => KEY } as unknown as ConfigService);

const PII_COLUMNS = ['birth_date', 'rg', 'address', 'bank_name', 'bank_branch', 'bank_account', 'pix_key', 'account_holder'] as const;
const PLAINTEXT = {
  birth_date: '1995-04-20', rg: '12.345.678-9', address: 'Rua Segredo, 1', bank_name: 'Banco Sigiloso',
  bank_branch: '0001', bank_account: '99887-6', pix_key: 'chave-pix-secreta', account_holder: 'Aurora Titular',
};

function makeService(existing: Record<string, unknown> = {}) {
  const store: { row: Record<string, unknown> } = {
    row: { id: 'artist-1', tenant_id: 't1', stage_name: 'MC Aurora', status: 'in_negotiation', metadata: {}, ...existing },
  };
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['where', 'andWhere', 'orderBy', 'skip', 'take']) qb[m] = jest.fn(() => qb);
  qb.getOne = jest.fn(async () => ({ ...store.row }));
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((value: Record<string, unknown>) => value),
    save: jest.fn(async (value: Record<string, unknown>) => { store.row = { id: 'artist-1', ...value }; return { ...store.row }; }),
    update: jest.fn(async (_criteria: unknown, updates: Record<string, unknown>) => { store.row = { ...store.row, ...updates }; return { affected: 1 }; }),
  };
  const ds = { getRepository: jest.fn(() => repo), query: jest.fn(async () => []) };
  const events = { emitTyped: jest.fn() };
  const planLimit = { enforce: jest.fn().mockResolvedValue(undefined) };
  const service = new ArtistsService(ds as any, encryption, events as any, planLimit as any);
  return { service, repo, store, qb, events };
}

describe('artists PII at rest (BLK-CRM-PII-PLAINTEXT)', () => {
  it('create(): persists ciphertext only; no plaintext value anywhere in the persisted row', async () => {
    const { service, repo } = makeService();
    await service.create('t1', 'u1', { stage_name: 'MC Aurora', ...PLAINTEXT, cpf_cnpj: '123.456.789-00' } as any);
    const persisted = repo.create.mock.calls[0][0] as Record<string, unknown>;

    for (const column of PII_COLUMNS) {
      expect(persisted[column]).toBeUndefined();
      expect(persisted[`${column}_encrypted`]).toEqual(expect.stringMatching(/^enc:v1:/));
      expect(encryption.decrypt(persisted[`${column}_encrypted`] as string)).toBe(PLAINTEXT[column]);
    }
    const serialized = JSON.stringify(persisted);
    for (const value of [...Object.values(PLAINTEXT), '123.456.789-00']) expect(serialized).not.toContain(value);
  });

  it('create(): plaintext PII sent inside metadata (canonical or Portuguese keys) is dropped, allow-listed keys kept', async () => {
    const { service, repo } = makeService();
    await service.create('t1', 'u1', {
      stage_name: 'MC Aurora',
      metadata: {
        rg: PLAINTEXT.rg, RG: PLAINTEXT.rg, banco: PLAINTEXT.bank_name, conta: PLAINTEXT.bank_account,
        chave_pix: PLAINTEXT.pix_key, titular_conta: PLAINTEXT.account_holder, data_nascimento: PLAINTEXT.birth_date,
        endereco: PLAINTEXT.address, 'bank-account': '1', cpf: '123', cnpj: '456', leadId: 'l1', gender: 'female',
      },
    } as any);
    const persisted = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(persisted.metadata).toEqual({ leadId: 'l1', gender: 'female' });
  });

  it('update(): the written field is stored as ciphertext and its plaintext column is nulled (this row only)', async () => {
    const { service, repo } = makeService({ rg: 'LEGACY-RG', bank_name: 'Banco Velho', bank_name_encrypted: null });
    await service.update('t1', 'u1', 'artist-1', { rg: PLAINTEXT.rg, banco: 'Banco Novo' } as any);

    const [criteria, updates] = repo.update.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(criteria).toMatchObject({ id: 'artist-1', tenant_id: 't1' });
    expect(updates.rg).toBeNull();
    expect(updates.bank_name).toBeNull();
    expect(encryption.decrypt(updates.rg_encrypted as string)).toBe(PLAINTEXT.rg);
    expect(encryption.decrypt(updates.bank_name_encrypted as string)).toBe('Banco Novo');
    // untouched fields are not part of the update (no collateral rewrite)
    expect(updates).not.toHaveProperty('pix_key');
    expect(updates).not.toHaveProperty('pix_key_encrypted');
    expect(JSON.stringify(updates)).not.toContain(PLAINTEXT.rg);
  });

  it('update(): clearing a field (null) clears both the ciphertext and the plaintext column', async () => {
    const { service, repo } = makeService({ pix_key: 'legacy', pix_key_encrypted: encryption.encrypt('x') });
    await service.update('t1', 'u1', 'artist-1', { pix_key: null } as any);
    expect(repo.update.mock.calls[0][1]).toMatchObject({ pix_key: null, pix_key_encrypted: null });
  });

  it('update(): PII keys in a caller metadata are never persisted; stored historical metadata is left to the gated backfill', async () => {
    const { service, repo } = makeService({ metadata: { leadId: 'l1', banco: 'historical' } });
    await service.update('t1', 'u1', 'artist-1', { metadata: { rg: 'x', conta: 'y', note: 'ok' } } as any);
    expect((repo.update.mock.calls[0][1] as any).metadata).toEqual({ leadId: 'l1', banco: 'historical', note: 'ok' });
  });

  it('response: decrypts ciphertext, passes legacy plaintext through, ciphertext wins when both exist', async () => {
    const { service } = makeService({
      rg_encrypted: encryption.encrypt('RG-CIPHER'), rg: 'RG-LEGACY-STALE',
      bank_account: 'LEGACY-ACCOUNT', bank_account_encrypted: null,
      birth_date: '1990-01-02', address_encrypted: encryption.encrypt('Rua Cifrada'),
    });
    const response = await service.findByIdForResponse('t1', 'artist-1') as unknown as Record<string, unknown>;
    expect(response).toMatchObject({
      rg: 'RG-CIPHER', bank_account: 'LEGACY-ACCOUNT', birth_date: '1990-01-02', address: 'Rua Cifrada',
      bank_name: null, pix_key: null, account_holder: null, bank_branch: null,
    });
  });

  it('response: never carries ciphertext columns, raw metadata or historical metadata PII', async () => {
    const { service } = makeService({
      rg_encrypted: encryption.encrypt('RG-CIPHER'), cpf_cnpj_encrypted: encryption.encrypt('111.222.333-44'),
      bank_name_encrypted: encryption.encrypt('Banco C'),
      metadata: { gender: 'male', rg: 'META-RG', banco: 'META-BANCO', chave_pix: 'META-PIX', cpf: 'META-CPF' },
    });
    const response = await service.findByIdForResponse('t1', 'artist-1') as unknown as Record<string, unknown>;
    for (const key of Object.keys(response)) expect(key).not.toMatch(/_encrypted$/);
    expect(response).not.toHaveProperty('metadata');
    const serialized = JSON.stringify(response);
    for (const leaked of ['META-RG', 'META-BANCO', 'META-PIX', 'META-CPF', 'enc:v1:']) expect(serialized).not.toContain(leaked);
    expect(response).toMatchObject({ rg: 'RG-CIPHER', cpf_cnpj: '111.222.333-44', bank_name: 'Banco C', gender: 'male' });
  });

  it('tenant isolation is unchanged: reads and writes are bound to the caller tenant', async () => {
    const { service, repo, qb } = makeService();
    await service.findByIdForResponse('tenant-x', 'artist-1');
    expect(qb.where).toHaveBeenCalledWith(expect.stringContaining('a.tenant_id = :tenantId'), expect.objectContaining({ tenantId: 'tenant-x' }));
    await service.update('tenant-x', 'u1', 'artist-1', { rg: 'x' } as any);
    expect(repo.update.mock.calls[0][0]).toMatchObject({ tenant_id: 'tenant-x' });
  });

  it('sanitizeArtistMetadataInput drops PII keys case/format-insensitively and keeps others', () => {
    expect(sanitizeArtistMetadataInput({ 'Chave Pix': 'x', 'BANK-NAME': 'y', Rg: 'z', keep: 1 })).toEqual({ keep: 1 });
  });

  it.each([
    'cpf', 'cnpj', 'cpf_cnpj', 'documento', 'document', 'rg', 'birth_date', 'data_nascimento', 'address', 'endereco',
    'bank_name', 'banco', 'bank_branch', 'agencia', 'bank_account', 'conta', 'pix_key', 'chave_pix', 'account_holder',
    'titular_conta', 'email', 'e_mail', 'phone', 'telefone', 'celular', 'manager_contact', 'manager_contato',
  ])('sanitizeArtistMetadataInput drops the plaintext PII key %j (canonical and pre-CZ-042 spellings) and keeps a neutral key', (key) => {
    expect(sanitizeArtistMetadataInput({ [key]: 'plaintext-secret', keep: 1 })).toEqual({ keep: 1 });
  });
});

describe('EncryptionService dual-read helpers', () => {
  it('decryptOrLegacy decrypts prefixed ciphertext and passes legacy plaintext through', () => {
    expect(encryption.decryptOrLegacy(encryption.encrypt('segredo'))).toBe('segredo');
    expect(encryption.decryptOrLegacy('plaintext-legado')).toBe('plaintext-legado');
    expect(encryption.decryptOrLegacy('')).toBeNull();
    expect(encryption.decryptOrLegacy(null)).toBeNull();
  });
  it('isCiphertext recognizes only the versioned prefix', () => {
    expect(encryption.isCiphertext(encryption.encrypt('a'))).toBe(true);
    expect(encryption.isCiphertext('a')).toBe(false);
    expect(encryption.isCiphertext(null)).toBe(false);
  });
});
