import { NotFoundException } from '@nestjs/common';
import { CompanySettingsService } from './company-settings.service';

function buildFakeDataSource(seed: {
  organizations: Record<string, unknown>;
  tenants: Record<string, unknown>;
}) {
  const state = {
    organizations: { ...seed.organizations },
    tenants: { ...seed.tenants },
  };

  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    const s = sql.replace(/\s+/g, ' ').trim();

    if (s.startsWith('SELECT id, name, phone, address, config, cnpj_encrypted FROM organizations')) {
      return state.organizations.id === params[0] ? [state.organizations] : [];
    }
    if (s.startsWith('SELECT id, settings FROM tenants')) {
      return state.tenants.id === params[0] ? [state.tenants] : [];
    }
    if (s.startsWith('SELECT config, address FROM organizations')) {
      return state.organizations.id === params[0] ? [{ config: state.organizations.config, address: state.organizations.address }] : [];
    }
    if (s.startsWith('UPDATE organizations')) {
      const [, name, phone, address, config, cnpj] = params as [string, string | null, string | null, string, string, string | null];
      if (name) state.organizations.name = name;
      if (phone) state.organizations.phone = phone;
      state.organizations.address = JSON.parse(address);
      state.organizations.config = JSON.parse(config);
      if (cnpj) state.organizations.cnpj_encrypted = cnpj;
      return [];
    }
    if (s.startsWith('SELECT settings FROM tenants')) {
      return state.tenants.id === params[0] ? [{ settings: state.tenants.settings }] : [];
    }
    if (s.startsWith('UPDATE tenants')) {
      const [, settings] = params as [string, string];
      state.tenants.settings = JSON.parse(settings);
      return [];
    }
    throw new Error(`Query not mapped in the fake DataSource: ${s}`);
  });

  const ds = {
    query,
    transaction: jest.fn(async (cb: (manager: { query: typeof query }) => Promise<void>) => cb({ query })),
  };

  return { ds, state };
}

const fakeEncryption = {
  encrypt: jest.fn((v: string) => `enc:${v}`),
  decrypt: jest.fn((v: string) => v.replace(/^enc:/, '')),
  encryptNullable: jest.fn((v: string | null) => (v == null ? null : `enc:${v}`)),
  decryptNullable: jest.fn((v: string | null) => (v == null ? null : v.replace(/^enc:/, ''))),
} as any;

describe('CompanySettingsService', () => {
  const ORG_ID = 'org-1';
  const TENANT_ID = 'tenant-1';

  function seedRow(): { organizations: Record<string, unknown>; tenants: Record<string, unknown> } {
    return {
      organizations: { id: ORG_ID, name: 'Nome Original', phone: null, address: {}, config: {}, cnpj_encrypted: null as string | null },
      tenants: { id: TENANT_ID, settings: {} },
    };
  }

  it('get() throws NotFoundException when the organization does not exist', async () => {
    const { ds } = buildFakeDataSource(seedRow());
    const audit = { log: jest.fn() };
    const svc = new CompanySettingsService(ds as any, fakeEncryption, audit as any);

    await expect(svc.get(TENANT_ID, 'org-inexistente')).rejects.toThrow(NotFoundException);
  });

  it('get() returns the decrypted CNPJ when present', async () => {
    const seed = seedRow();
    seed.organizations.cnpj_encrypted = 'enc:12.345.678/0001-99';
    const { ds } = buildFakeDataSource(seed);
    const audit = { log: jest.fn() };
    const svc = new CompanySettingsService(ds as any, fakeEncryption, audit as any);

    const result = await svc.get(TENANT_ID, ORG_ID);
    expect(result.cnpj).toBe('12.345.678/0001-99');
  });

  it('update() applies only the provided fields (partial update), preserving the rest', async () => {
    const seed = seedRow();
    seed.organizations.config = { tradeName: 'Nome Fantasia Antigo', website: 'https://antigo.com' };
    const { ds, state } = buildFakeDataSource(seed);
    const audit = { log: jest.fn() };
    const svc = new CompanySettingsService(ds as any, fakeEncryption, audit as any);

    await svc.update(TENANT_ID, ORG_ID, 'user-1', 'owner', { website: 'https://novo.com' });

    expect((state.organizations.config as any).website).toBe('https://novo.com');
    expect((state.organizations.config as any).tradeName).toBe('Nome Fantasia Antigo'); // preserved
  });

  it('update() encrypts the CNPJ before persisting', async () => {
    const { ds, state } = buildFakeDataSource(seedRow());
    const audit = { log: jest.fn() };
    const svc = new CompanySettingsService(ds as any, fakeEncryption, audit as any);

    await svc.update(TENANT_ID, ORG_ID, 'user-1', 'owner', { cnpj: '12.345.678/0001-99' });

    expect(state.organizations.cnpj_encrypted).toBe('enc:12.345.678/0001-99');
    expect(fakeEncryption.encryptNullable).toHaveBeenCalledWith('12.345.678/0001-99');
  });

  it('update() never writes the CNPJ in plain text to audit_logs — only a change marker', async () => {
    const { ds } = buildFakeDataSource(seedRow());
    const audit = { log: jest.fn() };
    const svc = new CompanySettingsService(ds as any, fakeEncryption, audit as any);

    await svc.update(TENANT_ID, ORG_ID, 'user-1', 'owner', { cnpj: '12.345.678/0001-99' });

    const call = audit.log.mock.calls[0][0];
    expect(JSON.stringify(call)).not.toContain('12.345.678/0001-99');
    expect(call.after.cnpj).toBe('[REDACTED]');
  });

  it('update() merges banking and contactName without erasing sibling fields in config', async () => {
    const seed = seedRow();
    seed.organizations.config = { tradeName: 'Nome Fantasia', banking: { bankName: 'Banco Antigo' } };
    const { ds, state } = buildFakeDataSource(seed);
    const audit = { log: jest.fn() };
    const svc = new CompanySettingsService(ds as any, fakeEncryption, audit as any);

    await svc.update(TENANT_ID, ORG_ID, 'user-1', 'owner', {
      contactName: 'Fulano de Tal',
      banking: { agency: '0001', account: '12345-6' },
    });

    expect((state.organizations.config as any).contactName).toBe('Fulano de Tal');
    expect((state.organizations.config as any).banking).toEqual({
      bankName: 'Banco Antigo',
      agency: '0001',
      account: '12345-6',
    });
    expect((state.organizations.config as any).tradeName).toBe('Nome Fantasia'); // preserved
  });

  it('update() only touches tenants.settings when timezone/currency/language are provided', async () => {
    const { ds, state } = buildFakeDataSource(seedRow());
    const audit = { log: jest.fn() };
    const svc = new CompanySettingsService(ds as any, fakeEncryption, audit as any);

    await svc.update(TENANT_ID, ORG_ID, 'user-1', 'owner', { legalName: 'Nova Razão Social' });
    expect(state.tenants.settings).toEqual({});

    await svc.update(TENANT_ID, ORG_ID, 'user-1', 'owner', { timezone: 'America/Sao_Paulo', currency: 'BRL', language: 'pt-BR' });
    expect(state.tenants.settings).toEqual({ timezone: 'America/Sao_Paulo', currency: 'BRL', language: 'pt-BR' });
  });

  it('update() audits with the correct tenantId/orgId/userId/action', async () => {
    const { ds } = buildFakeDataSource(seedRow());
    const audit = { log: jest.fn() };
    const svc = new CompanySettingsService(ds as any, fakeEncryption, audit as any);

    await svc.update(TENANT_ID, ORG_ID, 'user-1', 'owner', { legalName: 'Nova Razão Social' });

    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT_ID,
      orgId: ORG_ID,
      userId: 'user-1',
      actorRole: 'owner',
      action: 'company.settings_updated',
      entity: 'organizations',
      entityId: ORG_ID,
    }));
  });
});
