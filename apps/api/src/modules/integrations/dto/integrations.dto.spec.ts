/**
 * integrations.dto.spec.ts
 *
 * Fase 4 — testes obrigatórios para os DTOs recém-criados que substituíram
 * bodies inline/genéricos no IntegrationsController.
 */
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  RegisterAbramusWorkDto,
  ConfigureSoundCloudDto,
  OAuthCodeStateDto,
  AutentiqueWebhookDto,
} from './integrations.dto';

async function validatePayload(dto: new () => object, payload: Record<string, unknown>, opts?: { whitelist?: boolean }) {
  const instance = plainToInstance(dto, payload);
  return validate(instance, { whitelist: opts?.whitelist ?? true, forbidNonWhitelisted: opts?.whitelist ?? true });
}

describe('RegisterAbramusWorkDto', () => {
  it('aceita um payload válido mínimo', async () => {
    const errors = await validatePayload(RegisterAbramusWorkDto, { titulo: 'Obra X', compositor: 'Fulano' });
    expect(errors).toEqual([]);
  });

  it('aceita um payload válido completo', async () => {
    const errors = await validatePayload(RegisterAbramusWorkDto, {
      titulo: 'Obra X', compositor: 'Fulano', iswc: 'T-123', genero: 'Pop',
      duracao: '3:20', editora: 'Editora Y', coautores: ['Fulano', 'Beltrano'],
    });
    expect(errors).toEqual([]);
  });

  it('rejeita titulo ausente (missing required)', async () => {
    const errors = await validatePayload(RegisterAbramusWorkDto, { compositor: 'Fulano' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejeita compositor ausente (missing required)', async () => {
    const errors = await validatePayload(RegisterAbramusWorkDto, { titulo: 'Obra X' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejeita coautores com item não-string (invalid nested/type)', async () => {
    const errors = await validatePayload(RegisterAbramusWorkDto, {
      titulo: 'Obra X', compositor: 'Fulano', coautores: [123],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejeita campo desconhecido (unknown field)', async () => {
    const errors = await validatePayload(RegisterAbramusWorkDto, {
      titulo: 'Obra X', compositor: 'Fulano', campoInventado: true,
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('ConfigureSoundCloudDto', () => {
  it('aceita um payload válido', async () => {
    const errors = await validatePayload(ConfigureSoundCloudDto, { clientId: 'abc', clientSecret: 'def' });
    expect(errors).toEqual([]);
  });

  it('rejeita clientSecret ausente (missing required)', async () => {
    const errors = await validatePayload(ConfigureSoundCloudDto, { clientId: 'abc' });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('OAuthCodeStateDto (Instagram/TikTok/Google Ads callbacks)', () => {
  it('aceita um payload válido', async () => {
    const errors = await validatePayload(OAuthCodeStateDto, { code: 'abc123', state: 'xyz' });
    expect(errors).toEqual([]);
  });

  it('rejeita state ausente (missing required)', async () => {
    const errors = await validatePayload(OAuthCodeStateDto, { code: 'abc123' });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('AutentiqueWebhookDto (webhook externo — sem whitelist fechado no controller)', () => {
  it('aceita o payload real usado no teste do serviço (event/event_id/document_id)', async () => {
    const errors = await validatePayload(
      AutentiqueWebhookDto,
      { event: 'document.signed', event_id: 'event-a', document_id: 'doc-a' },
    );
    expect(errors).toEqual([]);
  });

  it('rejeita event com tipo inválido (invalid type)', async () => {
    const errors = await validatePayload(AutentiqueWebhookDto, { event: 123 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('aceita campos extras do provedor quando validado sem whitelist fechado (comportamento do controller real)', async () => {
    // O AutentiqueController usa @UsePipes(new ValidationPipe({ whitelist: false }))
    // exatamente porque a Autentique pode enviar campos que não modelamos.
    const errors = await validatePayload(
      AutentiqueWebhookDto,
      { event: 'document.signed', event_id: 'e1', document_id: 'd1', campo_da_autentique_nao_modelado: true },
      { whitelist: false },
    );
    expect(errors).toEqual([]);
  });
});
