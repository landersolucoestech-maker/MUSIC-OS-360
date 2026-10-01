/**
 * shares.dto.spec.ts
 *
 * Phase 5 / C6: holderName is the only DTO input that feeds holder_name
 * (toColumns() in shares.service.ts). Reproduces the global ValidationPipe
 * (whitelist + forbidNonWhitelisted, see main.ts) to prove, without
 * bootstrapping the whole app, that empty/whitespace-only is rejected with
 * 400 — never persisted as a blank holder. class-validator only runs
 * through this path; a service-level test (shares.service.spec.ts) does not
 * exercise it.
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
  const validationMetadata = getMetadataStorage().getTargetValidationMetadatas(dto, '', false, false);
  return Array.from(new Set(validationMetadata.map((m) => m.propertyName)));
}

describe('CreateShareDto/UpdateShareDto — holderName does not accept empty/whitespace (Phase 5 / C6)', () => {
  it('rejects holderName: "" (empty string)', async () => {
    const errors = await validatePayload(CreateShareDto, { holderName: '' });
    expect(errors.length).toBeGreaterThan(0);
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    expect(messages.some((m) => m.includes('nome do titular'))).toBe(true);
  });

  it('rejects holderName: "   " (spaces only)', async () => {
    const errors = await validatePayload(CreateShareDto, { holderName: '   ' });
    expect(errors.length).toBeGreaterThan(0);
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    expect(messages.some((m) => m.includes('nome do titular'))).toBe(true);
  });

  it('rejects empty holderName also in UpdateShareDto (PartialType inherits the validators)', async () => {
    const errors = await validatePayload(UpdateShareDto, { holderName: '' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts absent holderName (optional field)', async () => {
    const errors = await validatePayload(CreateShareDto, { holder: 'João' });
    expect(errors).toEqual([]);
  });

  it('accepts holderName with a real value, along with percentage', async () => {
    const errors = await validatePayload(CreateShareDto, { holderName: 'Maria Autora', percentage: 50 });
    expect(errors).toEqual([]);
  });

  it("holderName: null passes the pipe (class-validator treats null as \"absent\" via @IsOptional) — explicit column clearing is the service's responsibility, not the DTO's", async () => {
    // class-validator's @IsOptional() ignores all other validators
    // when the value is null (same treatment as undefined) — only @Matches
    // rejects an empty/whitespace string, which is a NON-null value. This test
    // documents this real behavior so it isn't confused with
    // "empty holderName is accepted": empty string IS rejected (tests above);
    // explicit null passes through and is handled in the service (see shares.service.spec.ts).
    const errors = await validatePayload(UpdateShareDto, { holderName: null });
    expect(errors).toEqual([]);
  });

  it('rejects non-whitelisted property (closed contract)', async () => {
    const errors = await validatePayload(CreateShareDto, { holderName: 'X', unknown_field: 'y' });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('CreateShareDto — regression: financial share fields remain intact (Phase 5 / C6)', () => {
  // C6 isolated holder_name/percentage (registry) from holder/external_artist_name/
  // payer/recipient (financial) — it never removed or renamed the financial
  // fields themselves. This regression fails if any of them is removed/renamed.
  const FINANCIAL_FIELDS = ['holder', 'external_artist_name', 'payer', 'recipient', 'share_type', 'percentage', 'direction', 'type'];

  it('CreateShareDto still declares all financial fields', () => {
    const props = decoratedPropertyNames(CreateShareDto);
    for (const field of FINANCIAL_FIELDS) expect(props).toContain(field);
  });

  it('a payload with only financial fields is still accepted by the pipe (none of them became required/removed)', async () => {
    const errors = await validatePayload(CreateShareDto, {
      holder: 'D', external_artist_name: 'AE', payer: 'P', recipient: 'DEST', share_type: 'external_receivable', percentage: 100,
    });
    expect(errors).toEqual([]);
  });
});
