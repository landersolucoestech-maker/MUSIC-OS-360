import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  DEFAULT_ORGANIZATION_INDUSTRY,
  LEGACY_ORGANIZATION_INDUSTRIES,
  ORGANIZATION_INDUSTRIES,
  canonicalOrganizationIndustry,
} from './organization-industry';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { ProvisionWorkspaceDto } from './dto/provision-workspace.dto';

const webSource = readFileSync(resolve(__dirname, '../../../../web/src/modules/auth/constants/organization-industry.ts'), 'utf8');
const webList = (name: string): string[] =>
  [...new RegExp(`${name} = \\[([^\\]]*)\\]`).exec(webSource)![1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);

const base = { organizationName: 'Org', workspaceName: 'WS', workspaceSlug: 'ws-one' };
const errorsFor = async <T extends object>(cls: new () => T, payload: object) => validate(plainToInstance(cls, payload));

describe('organization industry vocabulary', () => {
  it('web mirror: canonical ids, legacy map and the Register/Onboarding lists are set-equal/contained', () => {
    expect(webList('ORGANIZATION_INDUSTRIES').sort()).toEqual([...ORGANIZATION_INDUSTRIES].sort());
    const legacy = /LEGACY_ORGANIZATION_INDUSTRIES[^=]*= \{([^}]*)\}/.exec(webSource)![1];
    const pairs = [...legacy.matchAll(/(\w+): "([a-z_]+)"/g)].map((m) => [m[1], m[2]]);
    expect(pairs.sort()).toEqual(Object.entries(LEGACY_ORGANIZATION_INDUSTRIES).sort());
    for (const v of [...webList('REGISTER_INDUSTRY_VALUES'), ...webList('ONBOARDING_INDUSTRY_VALUES')]) {
      expect(ORGANIZATION_INDUSTRIES as readonly string[]).toContain(v);
    }
  });

  it('every value the web Register form sends is accepted by the provisioning DTO (S0 live bug)', async () => {
    const values = webList('REGISTER_INDUSTRY_VALUES');
    expect(values).toHaveLength(4);
    for (const segment of values) {
      expect(await errorsFor(ProvisionWorkspaceDto, { ...base, segment })).toEqual([]);
    }
  });

  it('the pre-fix Register values (produtora/escritorio) and other deprecated values are accepted and mapped', async () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_ORGANIZATION_INDUSTRIES)) {
      const provision = plainToInstance(ProvisionWorkspaceDto, { ...base, segment: legacy });
      expect(await validate(provision)).toEqual([]);
      expect(provision.segment).toBe(canonical);
      const onboarding = plainToInstance(CompleteOnboardingDto, { companyName: 'X', segment: legacy });
      expect(await validate(onboarding)).toEqual([]);
      expect(onboarding.segment).toBe(canonical);
    }
  });

  it('canonical values win and stay unchanged; unknown values are rejected', async () => {
    for (const segment of ORGANIZATION_INDUSTRIES) {
      const dto = plainToInstance(CompleteOnboardingDto, { companyName: 'X', segment });
      expect(await validate(dto)).toEqual([]);
      expect(dto.segment).toBe(segment);
    }
    expect(canonicalOrganizationIndustry(' Gravadora ')).toBe('record_label');
    expect((await errorsFor(ProvisionWorkspaceDto, { ...base, segment: 'banana' })).length).toBeGreaterThan(0);
    expect((await errorsFor(CompleteOnboardingDto, { companyName: 'X', segment: 'banana' })).length).toBeGreaterThan(0);
  });

  it('legacy ids never shadow a canonical id and the default is canonical', () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_ORGANIZATION_INDUSTRIES)) {
      expect(ORGANIZATION_INDUSTRIES as readonly string[]).not.toContain(legacy);
      expect(ORGANIZATION_INDUSTRIES as readonly string[]).toContain(canonical);
    }
    expect(ORGANIZATION_INDUSTRIES as readonly string[]).toContain(DEFAULT_ORGANIZATION_INDUSTRY);
  });
});
