import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ContactsService } from '../contacts/contacts.service';

const ALLOWED_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'mp4', 'mov']);
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/quicktime']);
const MAX_SIZE = 50 * 1024 * 1024;

@Injectable()
export class ContactAttachmentsService {
  private readonly attachments = new Map<string, Map<string, Array<Record<string, unknown>>>>();

  constructor(private readonly contactsService: ContactsService) {}

  async list(tenantId: string, contactId: string) {
    await this.contactsService.assertBelongsToTenant(tenantId, contactId);
    return this.forContact(tenantId, contactId);
  }

  async create(tenantId: string, contactId: string, payload: Record<string, unknown>) {
    await this.contactsService.assertBelongsToTenant(tenantId, contactId);
    this.validate(payload);
    const attachment = { ...payload, id: randomUUID(), contactId, createdAt: new Date().toISOString() };
    const current = this.forContact(tenantId, contactId);
    this.forTenant(tenantId).set(contactId, [attachment, ...current]);
    return attachment;
  }

  private forTenant(tenantId: string) {
    let tenantAttachments = this.attachments.get(tenantId);
    if (!tenantAttachments) {
      tenantAttachments = new Map<string, Array<Record<string, unknown>>>();
      this.attachments.set(tenantId, tenantAttachments);
    }
    return tenantAttachments;
  }

  private forContact(tenantId: string, contactId: string) {
    return this.forTenant(tenantId).get(contactId) ?? [];
  }

  private validate(payload: Record<string, unknown>) {
    const mimeType = String(payload['mimeType'] ?? '');
    const extension = String(payload['extension'] ?? '').replace(/^\./, '').toLowerCase();
    const size = Number(payload['size'] ?? 0);
    if (!ALLOWED_MIME_TYPES.has(mimeType)) throw new BadRequestException('Tipo de arquivo de anexo inválido.');
    if (!ALLOWED_EXTENSIONS.has(extension)) throw new BadRequestException('Extensão de arquivo de anexo inválida.');
    if (!Number.isFinite(size) || size <= 0 || size > MAX_SIZE) throw new BadRequestException('Tamanho de arquivo de anexo inválido.');
  }
}
