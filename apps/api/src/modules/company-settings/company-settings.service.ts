/**
 * company-settings.service.ts  (Part 73 — Block 6)
 *
 * The company's registration settings (legal name, trade name, CNPJ,
 * address, contacts, branding, domain, timezone/currency/language) —
 * tenant-scoped, auditable. The CNPJ is encrypted at rest via
 * EncryptionService (same pattern as any other PII field in the project).
 *
 * "Legal/registration" fields (name, CNPJ, address, contacts, branding)
 * live in `organizations` (the billing/legal-entity boundary). Regional
 * fields (timezone/currency/language) live in `tenants.settings`, following the
 * same convention OnboardingService already uses for these three fields —
 * never duplicate the source of truth between the two modules.
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.tokens';
import { EncryptionService } from '../../core/security/encryption.service';
import { AuditService } from '../../core/audit/audit.service';
import type { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';

interface OrganizationRow {
  id: string;
  name: string;
  phone: string | null;
  address: Record<string, unknown>;
  config: Record<string, unknown>;
  cnpj_encrypted: string | null;
}

interface TenantRow {
  id: string;
  settings: Record<string, unknown>;
}

@Injectable()
export class CompanySettingsService {
  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
  ) {}

  async get(tenantId: string, orgId: string) {
    const [org] = await this.ds.query(
      `SELECT id, name, phone, address, config, cnpj_encrypted FROM organizations WHERE id = $1`,
      [orgId],
    ) as OrganizationRow[];
    if (!org) throw new NotFoundException('Organização não encontrada');

    const [tenant] = await this.ds.query(
      `SELECT id, settings FROM tenants WHERE id = $1`,
      [tenantId],
    ) as TenantRow[];
    if (!tenant) throw new NotFoundException('Workspace não encontrado.');

    const config = org.config ?? {};
    const settings = tenant.settings ?? {};

    return {
      legalName: org.name,
      tradeName: (config['tradeName'] as string) ?? null,
      cnpj: org.cnpj_encrypted ? this.encryption.decrypt(org.cnpj_encrypted) : null,
      stateRegistration: (config['ie'] as string) ?? null,
      contactName: (config['contactName'] as string) ?? null,
      address: org.address ?? {},
      phone: org.phone,
      whatsapp: (config['whatsapp'] as string) ?? null,
      contactEmail: (config['contactEmail'] as string) ?? null,
      website: (config['website'] as string) ?? null,
      domain: (config['domain'] as string) ?? null,
      logoUrl: (config['logoUrl'] as string) ?? null,
      faviconUrl: (config['faviconUrl'] as string) ?? null,
      colors: (config['colors'] as Record<string, unknown>) ?? {},
      banking: (config['banking'] as Record<string, unknown>) ?? {},
      timezone: (settings['timezone'] as string) ?? null,
      currency: (settings['currency'] as string) ?? null,
      language: (settings['language'] as string) ?? null,
    };
  }

  async update(tenantId: string, orgId: string, userId: string, actorRole: string | null, dto: UpdateCompanySettingsDto) {
    const before = await this.get(tenantId, orgId);

    await this.ds.transaction(async (manager) => {
      const [orgRow] = await manager.query(
        `SELECT config, address FROM organizations WHERE id = $1 FOR UPDATE`,
        [orgId],
      ) as Array<{ config: Record<string, unknown>; address: Record<string, unknown> }>;
      if (!orgRow) throw new NotFoundException('Organização não encontrada');

      const mergedConfig: Record<string, unknown> = { ...(orgRow.config ?? {}) };
      if (dto.tradeName !== undefined) mergedConfig['tradeName'] = dto.tradeName;
      if (dto.stateRegistration !== undefined) mergedConfig['ie'] = dto.stateRegistration;
      if (dto.contactName !== undefined) mergedConfig['contactName'] = dto.contactName;
      if (dto.whatsapp !== undefined) mergedConfig['whatsapp'] = dto.whatsapp;
      if (dto.contactEmail !== undefined) mergedConfig['contactEmail'] = dto.contactEmail;
      if (dto.website !== undefined) mergedConfig['website'] = dto.website;
      if (dto.domain !== undefined) mergedConfig['domain'] = dto.domain;
      if (dto.logoUrl !== undefined) mergedConfig['logoUrl'] = dto.logoUrl;
      if (dto.faviconUrl !== undefined) mergedConfig['faviconUrl'] = dto.faviconUrl;
      if (dto.colors !== undefined) mergedConfig['colors'] = { ...(mergedConfig['colors'] as object ?? {}), ...dto.colors };
      if (dto.banking !== undefined) mergedConfig['banking'] = { ...(mergedConfig['banking'] as object ?? {}), ...dto.banking };

      const mergedAddress = dto.address !== undefined
        ? { ...(orgRow.address ?? {}), ...dto.address }
        : (orgRow.address ?? {});

      const cnpjEncrypted = dto.cnpj !== undefined ? this.encryption.encryptNullable(dto.cnpj) : undefined;

      await manager.query(
        `
        UPDATE organizations
           SET name = COALESCE($2, name),
               phone = COALESCE($3, phone),
               address = $4::jsonb,
               config = $5::jsonb,
               cnpj_encrypted = COALESCE($6, cnpj_encrypted),
               updated_at = now()
         WHERE id = $1
        `,
        [
          orgId,
          dto.legalName ?? null,
          dto.phone ?? null,
          JSON.stringify(mergedAddress),
          JSON.stringify(mergedConfig),
          cnpjEncrypted ?? null,
        ],
      );

      if (dto.timezone !== undefined || dto.currency !== undefined || dto.language !== undefined) {
        const [tenantRow] = await manager.query(
          `SELECT settings FROM tenants WHERE id = $1 FOR UPDATE`,
          [tenantId],
        ) as Array<{ settings: Record<string, unknown> }>;
        const mergedSettings = { ...(tenantRow?.settings ?? {}) };
        if (dto.timezone !== undefined) mergedSettings['timezone'] = dto.timezone;
        if (dto.currency !== undefined) mergedSettings['currency'] = dto.currency;
        if (dto.language !== undefined) mergedSettings['language'] = dto.language;

        await manager.query(
          `UPDATE tenants SET settings = $2::jsonb, updated_at = now() WHERE id = $1`,
          [tenantId, JSON.stringify(mergedSettings)],
        );
      }
    });

    const after = await this.get(tenantId, orgId);

    // The CNPJ is encrypted at rest precisely so it does not circulate in plain
    // text — audit_logs does not encrypt its jsonb columns, so never
    // persist the decrypted value there. Records only that it changed, not the value.
    const redactCnpj = <T extends { cnpj: string | null }>(snapshot: T) => ({ ...snapshot, cnpj: snapshot.cnpj ? '[REDACTED]' : null });

    await this.audit.log({
      tenantId,
      orgId,
      userId,
      actorRole,
      action: 'company.settings_updated',
      entity: 'organizations',
      entityId: orgId,
      before: redactCnpj(before) as unknown as Record<string, unknown>,
      after: redactCnpj(after) as unknown as Record<string, unknown>,
    });

    return after;
  }
}
