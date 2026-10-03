import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProvisionWorkspaceDto } from './provision-workspace.dto';

const base = { organizationName: 'Acme', workspaceName: 'Acme HQ', workspaceSlug: 'acme-hq' };
const errorsFor = async (extra: Record<string, unknown>) =>
  (await validate(plainToInstance(ProvisionWorkspaceDto, { ...base, ...extra }), { whitelist: true, forbidNonWhitelisted: true }))
    .map((e) => e.property);

describe('ProvisionWorkspaceDto consent contract (acceptedLgpd, acceptedTerms)', () => {
  it('accepts the camelCase boolean consent keys the web sends', async () => {
    expect(await errorsFor({ acceptedLgpd: true, acceptedTerms: true })).toEqual([]);
    expect(await errorsFor({ acceptedLgpd: false, acceptedTerms: false })).toEqual([]);
  });

  it('keeps the consent optional (absent is not an error and is not invented)', async () => {
    const dto = plainToInstance(ProvisionWorkspaceDto, base);
    expect(await validate(dto)).toEqual([]);
    expect(dto.acceptedLgpd).toBeUndefined();
  });

  it('rejects a non-boolean consent (a string or number is never coerced to true)', async () => {
    expect(await errorsFor({ acceptedLgpd: 'true' })).toContain('acceptedLgpd');
    expect(await errorsFor({ acceptedLgpd: 1 })).toContain('acceptedLgpd');
  });

  it('rejects the Supabase metadata spelling on the API body (the keys do not alias each other)', async () => {
    expect(await errorsFor({ accepted_lgpd: true })).toContain('accepted_lgpd');
  });
});
