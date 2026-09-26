import * as fs from 'fs';
import * as path from 'path';

/**
 * Guarda estática: campos persistidos pelos formulários devem existir no DTO
 * aceito pelo backend. O teste evita regressões em que a UI exibe e envia um
 * campo, mas whitelist/forbidNonWhitelisted o rejeita ou descarta.
 */
const entitiesSrc = fs.readFileSync(path.resolve(__dirname, 'entities.ts'), 'utf8');

function entityBlock(entityClassName: string): string {
  const start = entitiesSrc.indexOf(`export class ${entityClassName}`);
  if (start === -1) throw new Error(`Entity ${entityClassName} não encontrada em entities.ts`);
  const closingBrace = /\r?\n\}\r?\n/.exec(entitiesSrc.slice(start));
  if (!closingBrace) throw new Error(`Não foi possível localizar o fechamento da classe ${entityClassName}`);
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
      'endereco', 'contato_local', 'fee_amount', 'publico_esperado',
      'description', 'notes', 'participantes',
    ] as const;
    expectFields(block, fields, (field) => `\\b${field}\\b`);
    expectFields(dto, fields);
  });

  it('ReleaseEntity keeps the form fields in CreateReleaseDto', () => {
    const block = entityBlock('ReleaseEntity');
    const dto = source('../modules/releases/dto/releases.dto.ts');
    const fields = [
      'isrc_global', 'notas_internas', 'notes', 'gravadora',
      'copyright', 'music_genre', 'idioma', 'assets', 'cronograma',
    ] as const;
    expectFields(block, fields, (field) => `\\b${field}\\b`);
    expectFields(dto, fields);
  });

  it('TakedownEntity and CreateTakedownDto fully reflect the real modal', () => {
    const block = entityBlock('TakedownEntity');
    const dto = source('../modules/takedowns/dto/takedowns.dto.ts');
    const fields = [
      'title', 'type', 'obra_afetada', 'artista', 'plataforma',
      'prioridade', 'url_infracao', 'motivo', 'description', 'evidencias',
      'data_identificacao', 'status', 'notes',
    ] as const;
    expectFields(block, fields, (field) => `\\b${field}\\b`);
    expectFields(dto, fields);
  });

  it('InvoiceEntity and CreateInvoiceDto reflect the Nota Fiscal data and taxes', () => {
    const block = entityBlock('InvoiceEntity');
    const dto = source('../modules/invoices/dto/invoices.dto.ts');
    const fields = [
      'numero', 'serie', 'tipo_nota', 'client_id', 'natureza_operacao',
      'codigo_servico_municipal', 'codigo_municipio', 'cfop',
      'service_description', 'data_emissao', 'status',
      'tomador_cnpj', 'tomador_razao_social', 'tomador_inscricao_estadual',
      'tomador_inscricao_municipal', 'tomador_email', 'tomador_address',
      'tomador_city', 'tomador_uf', 'tomador_cep', 'service_amount',
      'deductions_amount', 'base_calculo', 'aliquota_iss', 'iss_amount',
      'iss_retido', 'pis_amount', 'cofins_amount', 'inss_amount', 'ir_amount',
      'csll_amount', 'net_amount', 'forma_pagamento', 'condicao_pagamento',
      'url_pdf', 'notes', 'itens',
    ] as const;
    expectFields(block, fields, (field) => `\\b${field}\\b`);
    expectFields(dto, fields);
    // "vencimento" is a DTO-only API alias for the entity's sole physical
    // column, data_vencimento (see invoices.service.ts's normalizePayload()
    // and report-form-contracts.ts's INVOICES_CONTRACT.formFieldAliases) --
    // it must stay off the entity, or the dual-write bug this consolidated
    // reappears.
    expectFields(block, ['data_vencimento'], (field) => `\\b${field}\\b`);
    expectFields(dto, ['vencimento']);
    expect(block).not.toMatch(/\bvencimento\b/);
  });

  it('Licensing accepts and preserves the conditional remuneration fields', () => {
    const entity = entityBlock('LicenseEntity');
    const dto = source('../modules/licensing/dto/licensing.dto.ts');
    const service = source('../modules/licensing/licensing.service.ts');
    expectFields(dto, ['remuneration_type', 'currency', 'amount', 'percentage']);
    expectFields(entity, ['percentage'], (field) => `\\b${field}\\b`);
    expect(service).toContain('{ valor: amount ?? valor ?? null }');
    expect(service).toContain('{ moeda: currency ?? moeda ?? null }');
    expect(service).toContain('...(percentage !== undefined ? { percentage } : {})');
    expect(service).toContain("percentage: raw['percentage'] == null ? null : Number(raw['percentage'])");
  });
});
