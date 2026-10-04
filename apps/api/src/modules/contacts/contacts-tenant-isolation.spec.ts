import { NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactAttachmentsService } from '../contact-attachments/contact-attachments.service';
import { ContactContractsService } from '../contact-contracts/contact-contracts.service';
import { ContactTimelineService } from '../contact-timeline/contact-timeline.service';

/**
 * contacts-tenant-isolation.spec.ts  (rewritten in Part 80)
 *
 * ContactsService stopped being an in-memory Map and became a facade over
 * ClientsService (the physical `contacts` table does not exist — see
 * contacts.service.ts). Real tenant isolation is already covered in
 * clients.service.spec.ts / client-entity-schema-alignment.spec.ts; this
 * spec now guarantees that the facade correctly FORWARDS the tenantId to
 * ClientsService on every operation, without leaking or swapping it for another.
 *
 * The facade never forwards an `id` coming from the caller to ClientsService.create()
 * (IDs are always generated server-side) — the mock below reflects this same
 * behavior; the tests capture the returned id instead of assuming a fixed one.
 */
function makeClientsServiceMock() {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  let counter = 0;
  const forTenant = (tenantId: string) => {
    let t = store.get(tenantId);
    if (!t) { t = new Map(); store.set(tenantId, t); }
    return t;
  };
  return {
    list: jest.fn(async (tenantId: string) => ({
      data: Array.from(forTenant(tenantId).values()),
      meta: { total: forTenant(tenantId).size, offset: 0, limit: 50 },
    })),
    findById: jest.fn(async (tenantId: string, id: string) => {
      const found = forTenant(tenantId).get(id);
      if (!found) throw new NotFoundException('Cliente não encontrado');
      return found;
    }),
    create: jest.fn(async (tenantId: string, _userId: string, dto: Record<string, unknown>) => {
      const id = `generated-id-${++counter}`;
      const entity = { id, name: dto['name'], ...dto };
      forTenant(tenantId).set(id, entity);
      return entity;
    }),
    update: jest.fn(async (tenantId: string, _userId: string, id: string, dto: Record<string, unknown>) => {
      const current = forTenant(tenantId).get(id);
      if (!current) throw new NotFoundException('Cliente não encontrado');
      const updated = { ...current, ...dto };
      forTenant(tenantId).set(id, updated);
      return updated;
    }),
    remove: jest.fn(async () => ({ deleted: true })),
  };
}

describe('ContactsService (facade) — correctly forwards tenant to ClientsService', () => {
  let clients: ReturnType<typeof makeClientsServiceMock>;
  let contacts: ContactsService;
  let attachments: ContactAttachmentsService;
  let contracts: ContactContractsService;
  let timeline: ContactTimelineService;

  beforeEach(() => {
    clients = makeClientsServiceMock();
    contacts = new ContactsService(clients as any);
    attachments = new ContactAttachmentsService(contacts);
    contracts = new ContactContractsService(contacts);
    timeline = new ContactTimelineService(contacts);
  });

  it('isolates contacts by tenant even with the same name in both', async () => {
    const a = await contacts.create('tenant-a', { name: 'Tenant A Contact' });
    const b = await contacts.create('tenant-b', { name: 'Tenant B Contact' });

    await expect(contacts.getById('tenant-a', a.id as string)).resolves.toMatchObject({ name: 'Tenant A Contact' });
    await expect(contacts.getById('tenant-b', b.id as string)).resolves.toMatchObject({ name: 'Tenant B Contact' });
    expect(clients.findById).toHaveBeenCalledWith('tenant-a', a.id);
    expect(clients.findById).toHaveBeenCalledWith('tenant-b', b.id);
  });

  it('does not allow tenant A to access a tenant B contact by id', async () => {
    const b = await contacts.create('tenant-b', { name: 'Tenant B Contact' });

    await expect(contacts.getById('tenant-a', b.id as string)).rejects.toThrow('Cliente não encontrado');
    await expect(contacts.update('tenant-a', b.id as string, { name: 'Changed' })).rejects.toThrow();
  });

  it("scopes attachments, linked contracts and timeline to the contact's tenant (via assertBelongsToTenant)", async () => {
    const a = await contacts.create('tenant-a', { name: 'Tenant A Contact' });
    const b = await contacts.create('tenant-b', { name: 'Tenant B Contact' });
    const contactA = a.id as string;
    const contactB = b.id as string;

    await attachments.create('tenant-a', contactA, {
      mimeType: 'application/pdf',
      extension: 'pdf',
      size: 1234,
      fileName: 'a.pdf',
    });
    await contracts.link('tenant-a', contactA, { contractId: 'contract-a' });
    await timeline.create('tenant-a', contactA, { type: 'note', description: 'tenant-a note' });

    await expect(attachments.list('tenant-a', contactA)).resolves.toHaveLength(1);
    await expect(contracts.list('tenant-a', contactA)).resolves.toHaveLength(1);
    await expect(timeline.list('tenant-a', contactA)).resolves.toHaveLength(1);

    await expect(attachments.list('tenant-b', contactB)).resolves.toEqual([]);
    await expect(contracts.list('tenant-b', contactB)).resolves.toEqual([]);
    await expect(timeline.list('tenant-b', contactB)).resolves.toEqual([]);
  });

  it('blocks access via subroute when the contact belongs to another tenant', async () => {
    const b = await contacts.create('tenant-b', { name: 'Tenant B Contact' });
    const contactB = b.id as string;

    await expect(attachments.list('tenant-a', contactB)).rejects.toThrow();
    await expect(contracts.list('tenant-a', contactB)).rejects.toThrow();
    await expect(timeline.list('tenant-a', contactB)).rejects.toThrow();
  });
});

/**
 * Legacy "Contact" facade contract: the facade still ACCEPTS the pre-canonical Contact payload keys and still
 * RETURNS the legacy Contact shape (documentType CPF|CNPJ, country, documentNumber). Each assertion below fails
 * when the matching legacy name/value is renamed or its precedence is swapped.
 */
describe('ContactsService (facade) — legacy Contact payload/response contract', () => {
  const clientsMock = () => ({
    list: jest.fn(),
    findById: jest.fn(async (_t: string, _id: string) => ({})),
    create: jest.fn(async (_t: string, _u: string, dto: Record<string, unknown>) => ({ id: 'c1', ...dto })),
    update: jest.fn(async (_t: string, _u: string, _id: string, dto: Record<string, unknown>) => ({ id: 'c1', ...dto })),
    remove: jest.fn(),
  });

  it('maps the legacy payload keys (cidade, cep, ...) to the canonical client DTO', async () => {
    const clients = clientsMock();
    const contacts = new ContactsService(clients as any);
    await contacts.create('t1', {
      nome: 'Maria', telefone: '11', endereco: 'Rua A', cidade: 'Santos', estado: 'SP', cep: '01000-000',
      observacoes: 'n', document_number: '123',
    });
    expect(clients.create.mock.calls[0][2]).toEqual({
      name: 'Maria', phone: '11', address: 'Rua A', city: 'Santos', state: 'SP', zip_code: '01000-000',
      notes: 'n', cpf_cnpj: '123',
    });
  });

  it('when a canonical and a legacy payload key are both sent the canonical one wins (city, zip_code)', async () => {
    const clients = clientsMock();
    const contacts = new ContactsService(clients as any);
    await contacts.create('t1', { city: 'Canonical', cidade: 'Legacy', zip_code: '11111-111', cep: '22222-222' });
    expect(clients.create.mock.calls[0][2]).toEqual({ city: 'Canonical', zip_code: '11111-111' });
  });

  it('returns the legacy Contact shape: documentType CPF for an individual, CNPJ otherwise, documentNumber from cpf_cnpj, country Brasil', async () => {
    const clients = clientsMock();
    const contacts = new ContactsService(clients as any);
    clients.findById.mockResolvedValueOnce({ id: 'c1', person_type: 'individual', cpf_cnpj: '111.222.333-44' });
    await expect(contacts.getById('t1', 'c1')).resolves.toMatchObject({
      documentType: 'CPF', documentNumber: '111.222.333-44', country: 'Brasil',
    });
    clients.findById.mockResolvedValueOnce({ id: 'c2', person_type: 'company', cpf_cnpj: '12.345.678/0001-00' });
    await expect(contacts.getById('t1', 'c2')).resolves.toMatchObject({
      documentType: 'CNPJ', documentNumber: '12.345.678/0001-00', country: 'Brasil',
    });
  });
});
