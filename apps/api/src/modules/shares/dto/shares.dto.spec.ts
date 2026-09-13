/**
 * shares.dto.spec.ts
 *
 * Fase 5 / C6: holderName é a única entrada do DTO que alimenta holder_name
 * (toColumns() em shares.service.ts). Reproduz o ValidationPipe global
 * (whitelist + forbidNonWhitelisted, ver main.ts) para provar, sem subir a
 * app inteira, que vazio/whitespace-only é rejeitado com 400 — nunca
 * persistido como titular em branco. class-validator só roda por este
 * caminho; um teste no nível do service (shares.service.spec.ts) não o
 * exercita.
 */
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, getMetadataStorage } from 'class-validator';
import { CreateShareDto, UpdateShareDto } from './shares.dto';

async function validatePayload(dto: new () => object, payload: Record<string, unknown>) {
  const instance = plainToInstance(dto, payload);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

function decoratedPropertyNames(dto: new () => object): string[] {
  const metas = getMetadataStorage().getTargetValidationMetadatas(dto, '', false, false);
  return Array.from(new Set(metas.map((m) => m.propertyName)));
}

describe('CreateShareDto/UpdateShareDto — holderName não aceita vazio/whitespace (Fase 5 / C6)', () => {
  it('rejeita holderName: "" (string vazia)', async () => {
    const errors = await validatePayload(CreateShareDto, { holderName: '' });
    expect(errors.length).toBeGreaterThan(0);
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    expect(messages.some((m) => m.includes('holderName'))).toBe(true);
  });

  it('rejeita holderName: "   " (somente espaços)', async () => {
    const errors = await validatePayload(CreateShareDto, { holderName: '   ' });
    expect(errors.length).toBeGreaterThan(0);
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    expect(messages.some((m) => m.includes('holderName'))).toBe(true);
  });

  it('rejeita holderName vazio também em UpdateShareDto (PartialType herda os validators)', async () => {
    const errors = await validatePayload(UpdateShareDto, { holderName: '' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('aceita holderName ausente (campo opcional)', async () => {
    const errors = await validatePayload(CreateShareDto, { holder: 'João' });
    expect(errors).toEqual([]);
  });

  it('aceita holderName com valor real, junto de percentage', async () => {
    const errors = await validatePayload(CreateShareDto, { holderName: 'Maria Autora', percentage: 50 });
    expect(errors).toEqual([]);
  });

  it('holderName: null passa pelo pipe (class-validator trata null como "ausente" via @IsOptional) — a limpeza explícita da coluna é responsabilidade do service, não do DTO', async () => {
    // @IsOptional() do class-validator ignora todos os outros validators
    // quando o valor é null (mesmo tratamento de undefined) — só @Matches
    // rejeita string vazia/whitespace, que é um valor NÃO-null. Este teste
    // documenta esse comportamento real para não ser confundido com
    // "holderName vazio é aceito": string vazia É rejeitada (testes acima);
    // null explícito passa e é tratado no service (ver shares.service.spec.ts).
    const errors = await validatePayload(UpdateShareDto, { holderName: null });
    expect(errors).toEqual([]);
  });

  it('rejeita propriedade não whitelisted (contrato fechado)', async () => {
    const errors = await validatePayload(CreateShareDto, { holderName: 'X', campo_inexistente: 'y' });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('CreateShareDto — regressão: campos do share financeiro permanecem intactos (Fase 5 / C6)', () => {
  // O C6 isolou holder_name/percentage (registro) de holder/artista_externo/
  // pagador/recipient (financeiro) — nunca removeu ou renomeou os campos
  // financeiros em si. Esta regressão falha se algum deles for removido/renomeado.
  const FINANCIAL_FIELDS = ['holder', 'artista_externo', 'pagador', 'recipient', 'share_type', 'percentage', 'direction', 'type'];

  it('CreateShareDto ainda declara todos os campos financeiros', () => {
    const props = decoratedPropertyNames(CreateShareDto);
    for (const field of FINANCIAL_FIELDS) expect(props).toContain(field);
  });

  it('um payload só com campos financeiros continua sendo aceito pelo pipe (nenhum deles virou obrigatório/removido)', async () => {
    const errors = await validatePayload(CreateShareDto, {
      holder: 'D', artista_externo: 'AE', pagador: 'P', recipient: 'DEST', share_type: 'pendente', percentage: 100,
    });
    expect(errors).toEqual([]);
  });
});
