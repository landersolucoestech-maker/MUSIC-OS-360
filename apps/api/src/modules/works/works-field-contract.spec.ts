import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateWorkDto } from './dto/create-work.dto';

/**
 * works-field-contract.spec.ts
 *
 * Guarda permanente (auditoria 2026-07-18 — contrato canônico de `works`).
 *
 * Rodada 8 (correção): `cod_abramus` estava genuinamente errado — não porque
 * devesse virar uma lista genérica, mas porque o nome amarra o campo a UMA
 * sociedade específica quando o valor pode ser um código na ABRAMUS, na UBC,
 * na SOCINPRO, entre outras entidades de gestão coletiva. O nome canônico
 * correto é `cod_entidade` (continua sendo UMA coluna simples — apenas
 * renomeada). `cod_ecad` CONTINUA existindo como coluna própria: ECAD é uma
 * entidade central e obrigatória de execução pública no Brasil, não uma
 * entre várias sociedades alternativas — não é fungível com `cod_entidade`.
 *
 * ValidationPipe global roda com { whitelist: true, forbidNonWhitelisted: true }:
 * qualquer chave fora do DTO derruba a request inteira com 400. Este teste
 * usa a mesma configuração para provar comportamentalmente o contrato.
 */
async function validateDto(payload: Record<string, unknown>) {
  const instance = plainToInstance(CreateWorkDto, payload);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

const MINIMAL_VALID = { title: 'Obra de Teste' };

describe('CreateWorkDto — contrato canônico de campos', () => {
  it('aceita `cod_ecad` (nome canônico real, ECAD é entidade central e obrigatória — não removida)', async () => {
    const errors = await validateDto({ ...MINIMAL_VALID, cod_ecad: 'ECAD-123' });
    expect(errors).toHaveLength(0);
  });

  it('aceita `cod_entidade` — substitui `cod_abramus`, valor pode ser código em ABRAMUS/UBC/SOCINPRO/outras', async () => {
    const errors = await validateDto({ ...MINIMAL_VALID, cod_entidade: 'ABR-123' });
    expect(errors).toHaveLength(0);
  });

  it('rejeita `cod_abramus`/`codAbramus` — renomeado para `cod_entidade` (20260718000017), nome amarrava a uma única sociedade', async () => {
    for (const key of ['cod_abramus', 'codAbramus']) {
      const errors = await validateDto({ ...MINIMAL_VALID, [key]: 'ABR-123' });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('rejeita colunas por sociedade específica — nunca uma por entidade (cod_ubc, cod_sbacem, ...)', async () => {
    for (const key of ['cod_ubc', 'cod_sbacem', 'cod_socinpro', 'cod_amar', 'cod_sicam', 'cod_assim']) {
      const errors = await validateDto({ ...MINIMAL_VALID, [key]: 'X' });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('rejeita `codigo_entidade` / `entity_code` — não existem no contrato real (o nome exato é `cod_entidade`)', async () => {
    for (const key of ['codigo_entidade', 'entity_code']) {
      const errors = await validateDto({ ...MINIMAL_VALID, [key]: 'X' });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('aceita compositor/compositores/editora/co_compositores-like legado sem quebrar (compat bulk/import)', async () => {
    const errors = await validateDto({
      ...MINIMAL_VALID,
      compositor: 'João Silva',
      compositores: [{ name: 'João Silva' }],
      editora: 'Editora XYZ',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejeita `detentor`/`holders` inventados — só `metadata`/campos declarados são aceitos', async () => {
    const errors = await validateDto({ ...MINIMAL_VALID, holders: ['x'], titulares: ['y'] });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejeita `detentores`/`co_compositores` — colunas removidas (migration 20260718000011, sem writer ativo)', async () => {
    const errors = await validateDto({ ...MINIMAL_VALID, detentores: 'x', co_compositores: 'y' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejeita `participantes[]` bruto como coluna — normalizado em work_participants (migration 20260718000011)', async () => {
    // `participantes` continua aceito no DTO (o service o traduz para linhas
    // filhas), mas não pode mais existir como coluna direta em `works`.
    const errors = await validateDto({ ...MINIMAL_VALID, participantes: [{ name: 'X', classeFuncao: 'compositor/autor' }] });
    expect(errors).toHaveLength(0);
  });
});
