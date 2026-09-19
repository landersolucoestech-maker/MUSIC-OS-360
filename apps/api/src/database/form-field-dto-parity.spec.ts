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

describe('Colunas dedicadas de formulário sempre expostas no DTO correspondente', () => {
  it('EventEntity mantém os campos do formulário em CreateEventDto', () => {
    const block = entityBlock('EventEntity');
    const dto = source('../modules/events/dto/events.dto.ts');
    const fields = [
      'endereco', 'contato_local', 'valor_cache', 'publico_esperado',
      'description', 'observacoes', 'participantes',
    ] as const;
    expectFields(block, fields, (field) => `\\b${field}\\b`);
    expectFields(dto, fields);
  });

  it('ReleaseEntity mantém os campos do formulário em CreateReleaseDto', () => {
    const block = entityBlock('ReleaseEntity');
    const dto = source('../modules/releases/dto/releases.dto.ts');
    const fields = [
      'isrc_global', 'notas_internas', 'observacoes', 'gravadora',
      'copyright', 'genero', 'idioma', 'assets', 'cronograma',
    ] as const;
    expectFields(block, fields, (field) => `\\b${field}\\b`);
    expectFields(dto, fields);
  });

  it('TakedownEntity e CreateTakedownDto refletem integralmente o modal real', () => {
    const block = entityBlock('TakedownEntity');
    const dto = source('../modules/takedowns/dto/takedowns.dto.ts');
    const fields = [
      'title', 'type', 'obra_afetada', 'artista', 'plataforma',
      'prioridade', 'url_infracao', 'motivo', 'description', 'evidencias',
      'data_identificacao', 'status', 'observacoes',
    ] as const;
    expectFields(block, fields, (field) => `\\b${field}\\b`);
    expectFields(dto, fields);
  });

  it('InvoiceEntity e CreateInvoiceDto refletem os dados e tributos da Nota Fiscal', () => {
    const block = entityBlock('InvoiceEntity');
    const dto = source('../modules/invoices/dto/invoices.dto.ts');
    const fields = [
      'numero', 'serie', 'tipo_nota', 'client_id', 'natureza_operacao',
      'codigo_servico_municipal', 'codigo_municipio', 'cfop',
      'service_description', 'data_emissao', 'vencimento', 'status',
      'tomador_cnpj', 'tomador_razao_social', 'tomador_inscricao_estadual',
      'tomador_inscricao_municipal', 'tomador_email', 'tomador_endereco',
      'tomador_cidade', 'tomador_uf', 'tomador_cep', 'valor_servicos',
      'valor_deducoes', 'base_calculo', 'aliquota_iss', 'valor_iss',
      'iss_retido', 'valor_pis', 'valor_cofins', 'valor_inss', 'valor_ir',
      'valor_csll', 'valor_liquido', 'forma_pagamento', 'condicao_pagamento',
      'url_pdf', 'notes', 'itens',
    ] as const;
    expectFields(block, fields, (field) => `\\b${field}\\b`);
    expectFields(dto, fields);
  });

  it('Licenciamento aceita e preserva os campos condicionais de remuneração', () => {
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
