import { Injectable, Optional } from '@nestjs/common';
import { ClientsService } from '../clients/clients.service';

/**
 * ContactsService — Part 80.
 *
 * Explicit facade over ClientsService. "Contact" and "Client" are the SAME
 * physical entity (the `clients` table) — a decision documented in
 * apps/api/src/database/migrations/20260719000010_RebuildClientsInCanonicalFormOrder.ts
 * ("Contact = Client") and confirmed in Part 79: the physical `contacts` table
 * was removed by a cleanup migration that never reached this
 * repository (it exists only in a pre-existing stash), leaving the old
 * ContactsService::listDb/createDb/... pointing to a nonexistent table
 * — 100% non-functional, never noticed because the frontend used a mock.
 *
 * Kept only for compatibility with contact-attachments/contact-timeline/
 * contact-contracts (which still call assertBelongsToTenant) and with any
 * external integrator already using /contacts. No logic of its own: everything
 * delegates to ClientsService, including tenant isolation, RBAC and persistence.
 * New code must use /clients directly — see
 * apps/api/src/modules/clients/clients.controller.ts for the canonical
 * endpoint with real timeline/attachments/contracts.
 */
@Injectable()
export class ContactsService {
  constructor(@Optional() private readonly clients?: ClientsService) {}

  async list(tenantId: string) {
    const result = await this.clients!.list(tenantId, {} as any);
    return result.data.map((c) => this.toContactShape(c));
  }

  async getById(tenantId: string, id: string) {
    const client = await this.clients!.findById(tenantId, id);
    return this.toContactShape(client);
  }

  async create(tenantId: string, payload: Record<string, unknown>, userId = 'system:contacts-facade') {
    const client = await this.clients!.create(tenantId, userId, this.toClientDto(payload) as any);
    return this.toContactShape(client);
  }

  async update(tenantId: string, id: string, payload: Record<string, unknown>, userId = 'system:contacts-facade') {
    const client = await this.clients!.update(tenantId, userId, id, this.toClientDto(payload) as any);
    return this.toContactShape(client);
  }

  async remove(tenantId: string, id: string, userId = 'system:contacts-facade') {
    return this.clients!.remove(tenantId, id, userId);
  }

  async assertBelongsToTenant(tenantId: string, id: string) {
    return this.getById(tenantId, id);
  }

  /** Client (ClientsService.mapClient) → legacy "Contact" shape. */
  private toContactShape(c: Record<string, unknown>) {
    return {
      id: c['id'],
      name: c['name'],
      companyName: c['legal_name'] ?? c['trade_name'] ?? null,
      contactType: c['category'] ?? 'OTHER',
      documentType: c['person_type'] === 'individual' ? 'CPF' : 'CNPJ',
      documentNumber: c['cpf_cnpj'] ?? null,
      phone: c['phone'] ?? null,
      whatsapp: c['phone'] ?? null,
      email: c['email'] ?? null,
      instagram: c['instagram'] ?? null,
      address: c['address'] ?? null,
      city: c['city'] ?? null,
      state: c['state'] ?? null,
      country: 'Brasil',
      zip_code: c['zip_code'] ?? null,
      responsible: c['responsible_name'] ?? null,
      notes: c['notes'] ?? null,
      tags: [],
      status: c['status'] ?? 'active',
      priority: c['priority'] ?? 'medium',
      linked_artist_id: null,
      // CZ-043: the client response no longer carries metadata (historical copies).
      metadata: {},
      created_at: c['created_at'],
      updated_at: c['updated_at'],
      deleted_at: c['deleted_at'] ?? null,
    };
  }

  /** Legacy "Contact" payload → CreateClientDto/UpdateClientDto. */
  private toClientDto(payload: Record<string, unknown>): Record<string, unknown> {
    const dto: Record<string, unknown> = {};
    const pick = (target: string, ...keys: string[]) => {
      for (const key of keys) {
        if (payload[key] !== undefined) { dto[target] = payload[key]; return; }
      }
    };
    pick('name', 'name', 'nome');
    pick('category', 'contact_type', 'contactType', 'type');
    pick('email', 'email');
    pick('phone', 'phone', 'telefone');
    pick('cpf_cnpj', 'document_number', 'documentNumber');
    pick('address', 'address', 'endereco');
    pick('city', 'city', 'cidade');
    pick('state', 'state', 'estado');
    pick('instagram', 'instagram');
    pick('zip_code', 'zip_code', 'zipCode', 'cep');
    pick('responsible_name', 'responsible', 'assignedTo');
    pick('notes', 'notes', 'observacoes');
    pick('expectedUpdatedAt', 'expectedUpdatedAt');
    pick('legal_name', 'company_name', 'companyName');
    if (payload['company_name'] !== undefined || payload['companyName'] !== undefined) {
      dto['person_type'] = 'company';
    }
    return dto;
  }
}
