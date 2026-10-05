import * as fs from 'fs';
import * as path from 'path';

/**
 * Static guard: fields persisted by the forms must exist in the DTO
 * accepted by the backend. The test prevents regressions in which the UI displays and sends a
 * field, but whitelist/forbidNonWhitelisted rejects or discards it.
 */
const entitiesSrc = fs.readFileSync(path.resolve(__dirname, 'entities.ts'), 'utf8');

function entityBlock(entityClassName: string): string {
  const start = entitiesSrc.indexOf(`export class ${entityClassName}`);
  if (start === -1) throw new Error(`Entity ${entityClassName} not found in entities.ts`);
  const closingBrace = /\r?\n\}\r?\n/.exec(entitiesSrc.slice(start));
  if (!closingBrace) throw new Error(`Could not locate the end of class ${entityClassName}`);
  return entitiesSrc.slice(start, start + closingBrace.index);
}

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
}

function expectFields(
  text: string,
  fields: readonly string[],
  pattern = (field: string) => `\\b${field}(?:\\?|!)?:`,
): void {
  for (const field of fields) expect(text).toMatch(new RegExp(pattern(field)));
}

describe('Dedicated form columns are always exposed in the matching DTO', () => {
  it('EventEntity keeps the form fields in CreateEventDto', () => {
    const block = entityBlock('EventEntity');
    const dto = source('../modules/events/dto/events.dto.ts');
    const fields = [
      'address', 'venue_contact', 'fee_amount', 'expected_attendance',
      'description', 'notes', 'participants',
    ] as const;
    expectFields(block, fields, (field) => `\\b${field}\\b`);
    expectFields(dto, fields);
  });

  it('ReleaseEntity keeps the form fields in CreateReleaseDto', () => {
    const block = entityBlock('ReleaseEntity');
    const dto = source('../modules/releases/dto/releases.dto.ts');
    const fields = [
      'isrc_global', 'internal_notes', 'notes', 'record_label',
      'copyright', 'music_genre', 'language', 'assets', 'schedule',
    ] as const;
    expectFields(block, fields, (field) => `\\b${field}\\b`);
    expectFields(dto, fields);
  });

  it('TakedownEntity and CreateTakedownDto fully reflect the real modal', () => {
    const block = entityBlock('TakedownEntity');
    const dto = source('../modules/takedowns/dto/takedowns.dto.ts');
    const fields = [
      'title', 'type', 'affected_work', 'artist_name', 'platform',
      'priority', 'infringing_url', 'reason', 'description', 'evidence',
      'identified_at', 'status', 'notes',
    ] as const;
    expectFields(block, fields, (field) => `\\b${field}\\b`);
    expectFields(dto, fields);
  });

  it('InvoiceEntity and CreateInvoiceDto reflect the Nota Fiscal data and taxes', () => {
    const block = entityBlock('InvoiceEntity');
    const dto = source('../modules/invoices/dto/invoices.dto.ts');
    const fields = [
      'invoice_number', 'serie', 'tipo_nota', 'client_id', 'natureza_operacao',
      'codigo_servico_municipal', 'codigo_municipio', 'cfop',
      'service_description', 'issued_at', 'due_at', 'status',
      'tomador_cnpj', 'tomador_legal_name', 'tomador_inscricao_estadual',
      'tomador_inscricao_municipal', 'tomador_email', 'tomador_address',
      'tomador_city', 'tomador_uf', 'tomador_cep', 'service_amount',
      'deductions_amount', 'base_calculo', 'aliquota_iss', 'iss_amount',
      'iss_retido', 'pis_amount', 'cofins_amount', 'inss_amount', 'ir_amount',
      'csll_amount', 'net_amount', 'payment_method', 'payment_terms',
      'file_url', 'url_pdf', 'notes', 'items',
    ] as const;
    expectFields(block, fields, (field) => `\\b${field}\\b`);
    expectFields(dto, fields);
    // The due date has a single physical column (`due_at`, CZ-036; formerly
    // data_vencimento with a DTO-only `vencimento` alias that once caused a
    // dual write) — no second `vencimento` column may reappear on the entity.
    expect(block).not.toMatch(/\bvencimento\b/);
  });

  it('Licensing accepts and preserves the conditional remuneration fields', () => {
    const entity = entityBlock('LicenseEntity');
    const dto = source('../modules/licensing/dto/licensing.dto.ts');
    const service = source('../modules/licensing/licensing.service.ts');
    expectFields(dto, ['remuneration_type', 'currency', 'amount', 'percentage']);
    // CZ-035: amount/currency are the physical columns (formerly valor/moeda,
    // still accepted as deprecated input via LICENSE_DEPRECATED_FIELDS).
    expectFields(entity, ['amount', 'currency', 'percentage'], (field) => `\\b${field}\\b`);
    expect(service).toContain('applyDeprecatedFieldAliases(dto as Record<string, unknown>, LICENSE_DEPRECATED_FIELDS)');
    expect(service).toContain("amount: raw['amount'] == null ? null : Number(raw['amount'])");
    expect(service).toContain("percentage: raw['percentage'] == null ? null : Number(raw['percentage'])");
  });
});
