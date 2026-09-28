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
 * SOCINPRO, or other collective-management entities. The column is ONE
 * generic code: `society_code` since CZ-039 (formerly cod_entidade).
 * `ecad_code` (formerly cod_ecad) STILL exists as its own column: ECAD is a
 * central, mandatory public-performance entity in Brazil, not one among
 * several alternative societies — it is not fungible with `society_code`.
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
  it('accepts `ecad_code` (ECAD is a central and mandatory entity — not removed)', async () => {
    const errors = await validateDto({ ...MINIMAL_VALID, ecad_code: 'ECAD-123' });
    expect(errors).toHaveLength(0);
  });

  it('accepts `society_code` — value can be a code at ABRAMUS/UBC/SOCINPRO/others', async () => {
    const errors = await validateDto({ ...MINIMAL_VALID, society_code: 'ABR-123' });
    expect(errors).toHaveLength(0);
  });

  it('rejects `cod_abramus`/`codAbramus` — the name tied the code to a single society (now `society_code`)', async () => {
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

  it('rejects `codigo_entidade` / `entity_code` — they do not exist in the real contract (the exact name is `society_code`)', async () => {
    for (const key of ['codigo_entidade', 'entity_code']) {
      const errors = await validateDto({ ...MINIMAL_VALID, [key]: 'X' });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('accepts composer_name/composer_names/publisher_name (bulk/import compat)', async () => {
    const errors = await validateDto({
      ...MINIMAL_VALID,
      composer_name: 'João Silva',
      composer_names: ['João Silva'],
      publisher_name: 'Editora XYZ',
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

  it('accepts `participants[]` — the service writes them into work_participants (never a works column)', async () => {
    const errors = await validateDto({ ...MINIMAL_VALID, participants: [{ name: 'X', role: 'composer_author' }] });
    expect(errors).toHaveLength(0);
  });
});
