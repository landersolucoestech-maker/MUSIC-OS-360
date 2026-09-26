import 'reflect-metadata';
import { ServiceUnavailableException } from '@nestjs/common';
import { PlatformContactService } from './platform-contact.service';
import type { PlatformContactDto } from './dto/platform-contact.dto';

/**
 * Platform Commercial Contact (2026-08-22 product decision): institutional
 * contact from the Music OS 360 landing page — never creates a Support
 * Ticket/MusicChat/lead/tenant record; forwards by e-mail via the real MailService
 * to PLATFORM_CONTACT_RECIPIENT_EMAIL (never an invented address).
 */
function makeService(hasRecipient = true) {
  const recipient = hasRecipient ? 'contato@musicos360.com.br' : undefined;
  const mail = { send: jest.fn(async () => ({ id: 'mail-1' })) };
  const config = { get: jest.fn(() => recipient) };
  const svc = new PlatformContactService(mail as never, config as never);
  return { svc, mail, config };
}

function lastMailCall(mail: { send: jest.Mock }): { to: string; replyTo: string; html: string } {
  const calls = mail.send.mock.calls as unknown as Array<[{ to: string; replyTo: string; html: string }]>;
  return calls[0]![0];
}

const BASE_DTO: PlatformContactDto = {
  name: 'Fulano Empresa',
  email: 'fulano@empresa.com',
  company: 'Empresa X',
  message: 'Gostaríamos de saber mais sobre o Music OS 360.',
};

describe('PlatformContactService.submit', () => {
  it('forwards by email to the configured recipient, with the sender as reply-to', async () => {
    const { svc, mail } = makeService();
    const result = await svc.submit(BASE_DTO);

    expect(result).toEqual({ accepted: true });
    expect(mail.send).toHaveBeenCalledTimes(1);
    const call = lastMailCall(mail);
    expect(call.to).toBe('contato@musicos360.com.br');
    expect(call.replyTo).toBe('fulano@empresa.com');
    expect(call.html).toContain('Fulano Empresa');
    expect(call.html).toContain('Gostaríamos de saber mais');
  });

  it('escapa HTML no nome/empresa/mensagem antes de interpolar no e-mail', async () => {
    const { svc, mail } = makeService();
    await svc.submit({
      ...BASE_DTO,
      name: '<img src=x onerror=alert(1)>',
      message: '<script>alert(2)</script>',
    });

    const html = lastMailCall(mail).html;
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script>alert(2)</script>');
    expect(html).toContain('&lt;img');
  });

  it('honeypot filled: silently accepts, never sends email', async () => {
    const { svc, mail } = makeService();
    const result = await svc.submit({ ...BASE_DTO, website: 'https://bot.example' });

    expect(result).toEqual({ accepted: true });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('without PLATFORM_CONTACT_RECIPIENT_EMAIL configured: an honest 503, never fakes success', async () => {
    const { svc, mail } = makeService(false);
    await expect(svc.submit(BASE_DTO)).rejects.toThrow(ServiceUnavailableException);
    expect(mail.send).not.toHaveBeenCalled();
  });
});
