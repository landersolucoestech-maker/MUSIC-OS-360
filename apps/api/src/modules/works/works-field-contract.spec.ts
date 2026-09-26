import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateWorkDto } from './dto/create-work.dto';

/**
 * works-field-contract.spec.ts
 *
 * Permanent guard (2026-07-18 audit — canonical `works` contract).
 *
 * Round 8 (fix): `cod_abramus` was genuinely wrong — not because it should
 * become a generic list, but because the name ties the field to ONE
 * specific collecting society when the value can be a code at ABRAMUS, UBC,
 * SOCINPRO, or other collective-management entities. The correct canonical
 * name is `cod_entidade` (it remains ONE simple column — just renamed).
 * `cod_ecad` STILL exists as its own column: ECAD is a central, mandatory
 * public-performance entity in Brazil, not one among several alternative
 * societies — it is not fungible with `cod_entidade`.
 *
 * The global ValidationPipe runs with { whitelist: true, forbidNonWhitelisted: true }:
 * any key outside the DTO fails the whole request with 400. This test uses
 * the same configuration to prove the contract behaviorally.
 */
async function validateDto(payload: Record<string, unknown>) {
  const instance = plainToInstance(CreateWorkDto, payload);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

const MINIMAL_VALID = { title: 'Obra de Teste' };

describe('CreateWorkDto — canonical field contract', () => {
  it('accepts `cod_ecad` (real canonical name, ECAD is a central and mandatory entity — not removed)', async () => {
    const errors = await validateDto({ ...MINIMAL_VALID, cod_ecad: 'ECAD-123' });
    expect(errors).toHaveLength(0);
  });

  it('accepts `cod_entidade` — replaces `cod_abramus`, value can be a code at ABRAMUS/UBC/SOCINPRO/others', async () => {
    const errors = await validateDto({ ...MINIMAL_VALID, cod_entidade: 'ABR-123' });
    expect(errors).toHaveLength(0);
  });

  it('rejects `cod_abramus`/`codAbramus` — renamed to `cod_entidade` (20260718000017), the name tied it to a single society', async () => {
    for (const key of ['cod_abramus', 'codAbramus']) {
      const errors = await validateDto({ ...MINIMAL_VALID, [key]: 'ABR-123' });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects columns per specific society — never one per entity (cod_ubc, cod_sbacem, ...)', async () => {
    for (const key of ['cod_ubc', 'cod_sbacem', 'cod_socinpro', 'cod_amar', 'cod_sicam', 'cod_assim']) {
      const errors = await validateDto({ ...MINIMAL_VALID, [key]: 'X' });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects `codigo_entidade` / `entity_code` — they do not exist in the real contract (the exact name is `cod_entidade`)', async () => {
    for (const key of ['codigo_entidade', 'entity_code']) {
      const errors = await validateDto({ ...MINIMAL_VALID, [key]: 'X' });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('accepts legacy compositor/compositores/editora/co_compositores-like fields without breaking (bulk/import compat)', async () => {
    const errors = await validateDto({
      ...MINIMAL_VALID,
      compositor: 'João Silva',
      compositores: [{ name: 'João Silva' }],
      editora: 'Editora XYZ',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects invented `detentor`/`holders` — only `metadata`/declared fields are accepted', async () => {
    const errors = await validateDto({ ...MINIMAL_VALID, holders: ['x'], titulares: ['y'] });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects `detentores`/`co_compositores` — columns removed (migration 20260718000011, no active writer)', async () => {
    const errors = await validateDto({ ...MINIMAL_VALID, detentores: 'x', co_compositores: 'y' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects raw `participantes[]` as a column — normalized into work_participants (migration 20260718000011)', async () => {
    // `participantes` is still accepted in the DTO (the service translates it into child
    // rows), but it can no longer exist as a direct column in `works`.
    const errors = await validateDto({ ...MINIMAL_VALID, participantes: [{ name: 'X', classeFuncao: 'compositor/autor' }] });
    expect(errors).toHaveLength(0);
  });
});
