import { ValidationPipe } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { z } from 'zod';
import { validationExceptionFactory, zodMessagesPtBr } from './validation-messages';

class AddressDto {
  @IsString() city!: string;
}

class ArtistPayloadDto {
  @IsString() @IsNotEmpty() fullName!: string;
  @IsEmail() email!: string;
  @Matches(/^[a-z]{3}$/, { message: 'A moeda deve ser um código ISO de 3 letras minúsculas (ex.: brl).' }) currency!: string;
  @ValidateNested() @Type(() => AddressDto) address!: AddressDto;
}

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: validationExceptionFactory,
});

async function messagesFor(payload: Record<string, unknown>): Promise<string[]> {
  try {
    await pipe.transform(payload, { type: 'body', metatype: ArtistPayloadDto });
  } catch (err) {
    return (err as { getResponse(): { message: string[] } }).getResponse().message;
  }
  throw new Error('expected validation to fail');
}

const ENGLISH_DEFAULTS = /must be|should not|property |each value in|is not|Expected|Required/;

describe('validation → PT-BR end-user copy boundary', () => {
  it('turns class-validator defaults into PT-BR copy with the canonical field label', async () => {
    const messages = await messagesFor({ fullName: 42, email: 'x', currency: 'brl', address: { city: 'SP' } });
    expect(messages).toContain('O campo "Nome completo" deve ser um texto.');
    expect(messages).toContain('O campo "E-mail" deve ser um e-mail válido.');
    for (const m of messages) expect(m).not.toMatch(ENGLISH_DEFAULTS);
  });

  it('never exposes an internal property name for non-whitelisted input', async () => {
    const messages = await messagesFor({
      fullName: 'A', email: 'a@b.co', currency: 'brl', address: { city: 'SP' }, internalFlag: true,
    });
    expect(messages).toEqual(['Um dos campos não é permitido.']);
    expect(messages.join(' ')).not.toContain('internalFlag');
  });

  it('keeps explicit PT-BR copy written by the DTO author', async () => {
    const messages = await messagesFor({ fullName: 'A', email: 'a@b.co', currency: 'BRL', address: { city: 'SP' } });
    expect(messages).toEqual(['A moeda deve ser um código ISO de 3 letras minúsculas (ex.: brl).']);
  });

  it('handles nested properties without leaking the path', async () => {
    const messages = await messagesFor({ fullName: 'A', email: 'a@b.co', currency: 'brl', address: { city: 7 } });
    expect(messages).toEqual(['O campo "Cidade" deve ser um texto.']);
    expect(messages.join(' ')).not.toContain('address');
  });
});

describe('zod → PT-BR end-user copy boundary', () => {
  const schema = z.object({ name: z.string(), status: z.enum(['a', 'b']) }).strict();

  it('maps zod defaults to PT-BR copy and keeps no English default text', () => {
    const result = schema.safeParse({ status: 'c', extra: 1 });
    expect(result.success).toBe(false);
    const messages = zodMessagesPtBr((result as { error: z.ZodError }).error);
    expect(messages).toContain('O campo "Nome" é obrigatório.');
    expect(messages).toContain('O campo "Situação" possui um valor não permitido.');
    expect(messages).toContain('Os dados enviados contêm campos não permitidos.');
    for (const m of messages) expect(m).not.toMatch(ENGLISH_DEFAULTS);
  });

  it('keeps a custom issue message written by the schema author', () => {
    const custom = z.string().refine((v) => v.length > 3, { message: 'Informe pelo menos 4 caracteres.' });
    const result = custom.safeParse('ab');
    expect(zodMessagesPtBr((result as { error: z.ZodError }).error)).toEqual(['Informe pelo menos 4 caracteres.']);
  });
});
