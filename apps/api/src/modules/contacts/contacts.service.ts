import { Injectable, Optional } from '@nestjs/common';
import { ClientsService } from '../clients/clients.service';

/**
 * ContactsService — Parte 80.
 *
 * Facade explícita sobre ClientsService. "Contato" e "Cliente" são a MESMA
 * entidade física (tabela `clients`) — decisão documentada em
 * apps/api/src/database/migrations/20260719000010_RebuildClientsInCanonicalFormOrder.ts
 * ("Contato = Cliente") e confirmada na Parte 79: a tabela física `contacts`
 * foi removida por uma migration de limpeza que nunca chegou a este
 * repositório (só existe em um stash pré-existente), deixando o antigo
 * ContactsService::listDb/createDb/... apontando para uma tabela inexistente
 * — 100% não funcional, nunca notado porque o frontend usava um mock.
 *
 * Mantido apenas por compatibilidade com contact-attachments/contact-timeline/
 * contact-contracts (que ainda chamam assertBelongsToTenant) e com qualquer
 * integrador externo que já use /contacts. Nenhuma lógica própria: tudo
 * delega a ClientsService, incluindo tenant isolation, RBAC e persistência.
 * Novo código deve usar /clients diretamente — ver
 * apps/api/src/modules/clients/clients.controller.ts para o endpoint
 * canônico com timeline/anexos/contratos reais.
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

  /** Cliente (ClientsService.mapClient) → forma "Contact" legada. */
  private toContactShape(c: Record<string, unknown>) {
    return {
      id: c['id'],
      name: c['name'] ?? c['nome'],
      companyName: c['razao_social'] ?? c['trade_name'] ?? null,
      contactType: c['categoria'] ?? 'OTHER',
      documentType: c['tipo_pessoa'] === 'pessoa_fisica' ? 'CPF' : 'CNPJ',
      documentNumber: c['document'] ?? null,
      phone: c['phone'] ?? null,
      whatsapp: c['phone'] ?? null,
      email: c['email'] ?? null,
      instagram: c['instagram'] ?? null,
      address: c['endereco_completo'] ?? c['address'] ?? null,
      city: c['cidade'] ?? null,
      state: c['estado'] ?? null,
      country: 'Brasil',
      zip_code: c['cep'] ?? null,
      responsible: c['responsavel_nome'] ?? null,
      notes: c['observacoes'] ?? null,
      tags: [],
      status: c['status'] ?? 'active',
      priority: 'medium',
      linked_artist_id: null,
      metadata: c['metadata'] ?? {},
      created_at: c['created_at'],
      updated_at: c['updated_at'],
      deleted_at: c['deleted_at'] ?? null,
    };
  }

  /** Payload "Contact" legado → CreateClientDto/UpdateClientDto. */
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
    pick('document', 'document_number', 'documentNumber');
    pick('address', 'address', 'endereco');
    pick('city', 'city', 'cidade');
    pick('state', 'state', 'estado');
    pick('instagram', 'instagram');
    pick('zipCode', 'zip_code', 'zipCode', 'cep');
    pick('responsible', 'responsible', 'assignedTo');
    pick('notes', 'notes', 'observacoes');
    pick('expectedUpdatedAt', 'expectedUpdatedAt');
    if (payload['company_name'] !== undefined || payload['companyName'] !== undefined) {
      dto['type'] = 'company';
    }
    return dto;
  }
}
