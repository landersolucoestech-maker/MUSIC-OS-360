/**
 * integrations.dto.spec.ts
 *
 * Phase 4 — mandatory tests for the newly created DTOs that replaced
 * inline/generic bodies in IntegrationsController.
 */
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  RegisterAbramusWorkDto,
  ABRAMUS_WORK_DEPRECATED_FIELDS,
  ConfigureSoundCloudDto,
  OAuthCodeStateDto,
  AutentiqueWebhookDto,
} from './integrations.dto';
import { applyDeprecatedFieldAliases } from '../../../common/compat/deprecated-field-aliases.util';

async function validatePayload(dto: new () => object, payload: Record<string, unknown>, opts?: { whitelist?: boolean }) {
  const instance = plainToInstance(dto, payload);
  return validate(instance, { whitelist: opts?.whitelist ?? true, forbidNonWhitelisted: opts?.whitelist ?? true });
}

describe('RegisterAbramusWorkDto', () => {
  const ok = { title: 'Obra X', composer: 'Fulano' };

  it('accepts a minimal canonical payload', async () => {
    expect(await validatePayload(RegisterAbramusWorkDto, ok)).toEqual([]);
  });

  it('accepts a complete canonical payload', async () => {
    const errors = await validatePayload(RegisterAbramusWorkDto, {
      ...ok, iswc: 'T-123', genre: 'Pop', duration: '3:20', publisher: 'Editora Y',
      co_composers: ['Fulano', 'Beltrano'],
    });
    expect(errors).toEqual([]);
  });

  it.each([
    ['titulo', { titulo: 'Obra X', composer: 'Fulano' }],
    ['compositor', { title: 'Obra X', compositor: 'Fulano' }],
    ['coautores', { ...ok, coautores: ['A'] }],
    ['genero', { ...ok, genero: 'Pop' }],
    ['duracao', { ...ok, duracao: '3:20' }],
    ['editora', { ...ok, editora: 'Y' }],
  ])('accepts the deprecated alias %s alone', async (_n, payload) => {
    expect(await validatePayload(RegisterAbramusWorkDto, payload)).toEqual([]);
  });

  it('accepts both canonical and deprecated names (resolution is canonical-wins, see wiring spec)', async () => {
    const errors = await validatePayload(RegisterAbramusWorkDto, { ...ok, titulo: 'Velho', compositor: 'Velho' });
    expect(errors).toEqual([]);
  });

  it('applyDeprecatedFieldAliases with ABRAMUS_WORK_DEPRECATED_FIELDS: canonical wins, deprecated keys removed', () => {
    const out = applyDeprecatedFieldAliases(
      { title: 'Novo', titulo: 'Velho', compositor: 'C', coautores: ['A'], genero: 'Pop' } as Record<string, unknown>,
      ABRAMUS_WORK_DEPRECATED_FIELDS,
    );
    expect(out).toEqual({ title: 'Novo', composer: 'C', co_composers: ['A'], genre: 'Pop' });
  });

  it('rejects a missing title (and no titulo)', async () => {
    const errors = await validatePayload(RegisterAbramusWorkDto, { composer: 'Fulano' });
    expect(errors.map((e) => e.property)).toContain('title');
  });

  it('rejects a missing composer (and no compositor)', async () => {
    const errors = await validatePayload(RegisterAbramusWorkDto, { title: 'Obra X' });
    expect(errors.map((e) => e.property)).toContain('composer');
  });

  it('rejects an empty composer even when the deprecated alias is present', async () => {
    const errors = await validatePayload(RegisterAbramusWorkDto, { title: 'Obra X', composer: '', compositor: 'Fulano' });
    expect(errors.map((e) => e.property)).toContain('composer');
  });

  it('rejects an empty title', async () => {
    const errors = await validatePayload(RegisterAbramusWorkDto, { title: '', composer: 'Fulano' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-string co_composers item', async () => {
    const errors = await validatePayload(RegisterAbramusWorkDto, { ...ok, co_composers: [123] });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-string coautores item (deprecated alias)', async () => {
    const errors = await validatePayload(RegisterAbramusWorkDto, { ...ok, coautores: [123] });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an unknown key', async () => {
    const errors = await validatePayload(RegisterAbramusWorkDto, { ...ok, campoInventado: true });
    expect(errors.length).toBeGreaterThan(0);
  });

  // Security review: a null deprecated alias must not satisfy the required canonical field
  // (the alias fold drops null, so the service would receive no title / composer).
  it.each([
    ['null titulo with a canonical composer', { composer: 'Fulano', titulo: null }],
    ['null compositor with a canonical title', { title: 'Obra X', compositor: null }],
    ['null titulo and null compositor', { titulo: null, compositor: null }],
    ['null title with a null titulo', { title: null, titulo: null, composer: 'Fulano' }],
  ])('rejects %s', async (_name, payload) => {
    const errors = await validatePayload(RegisterAbramusWorkDto, payload);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('ConfigureSoundCloudDto', () => {
  it('accepts a valid payload', async () => {
    const errors = await validatePayload(ConfigureSoundCloudDto, { clientId: 'abc', clientSecret: 'def' });
    expect(errors).toEqual([]);
  });

  it('rejects a missing clientSecret (missing required)', async () => {
    const errors = await validatePayload(ConfigureSoundCloudDto, { clientId: 'abc' });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('OAuthCodeStateDto (Instagram/TikTok/Google Ads callbacks)', () => {
  it('accepts a valid payload', async () => {
    const errors = await validatePayload(OAuthCodeStateDto, { code: 'abc123', state: 'xyz' });
    expect(errors).toEqual([]);
  });

  it('rejects a missing state (missing required)', async () => {
    const errors = await validatePayload(OAuthCodeStateDto, { code: 'abc123' });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('AutentiqueWebhookDto (external webhook — no closed whitelist in the controller)', () => {
  it('accepts the real payload used in the service test (event/event_id/document_id)', async () => {
    const errors = await validatePayload(
      AutentiqueWebhookDto,
      { event: 'document.signed', event_id: 'event-a', document_id: 'doc-a' },
    );
    expect(errors).toEqual([]);
  });

  it('rejects an event with an invalid type (invalid type)', async () => {
    const errors = await validatePayload(AutentiqueWebhookDto, { event: 123 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts extra provider fields when validated without a closed whitelist (real controller behavior)', async () => {
    // AutentiqueController uses @UsePipes(new ValidationPipe({ whitelist: false }))
    // precisely because Autentique may send fields we do not model.
    const errors = await validatePayload(
      AutentiqueWebhookDto,
      { event: 'document.signed', event_id: 'e1', document_id: 'd1', campo_da_autentique_nao_modelado: true },
      { whitelist: false },
    );
    expect(errors).toEqual([]);
  });
});
