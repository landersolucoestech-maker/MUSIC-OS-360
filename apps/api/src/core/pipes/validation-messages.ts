/**
 * Validation error → end-user copy boundary.
 *
 * HTTP exception messages are end-user copy (PT-BR): the web renders them via
 * toUserMessage(). class-validator and zod produce English, technical default
 * messages that name internal properties ("title must be a string",
 * "property foo should not exist", "Expected string, received number").
 * This module is the single place that turns those into PT-BR copy, using the
 * canonical field-label dictionary. The technical detail (property path,
 * constraint, default message) is logged in English, never returned.
 */
import { BadRequestException, Logger, ValidationError } from '@nestjs/common';
import type { ZodError, ZodIssue } from 'zod';
import { tryGetFieldLabelPtBr } from '../../modules/reports/i18n/field-labels.pt-br';

const logger = new Logger('RequestValidation');

/** class-validator constraint name → PT-BR predicate (subject is the field label). */
const CONSTRAINT_PHRASES_PT_BR: Readonly<Record<string, string>> = {
  isNotEmpty: 'é obrigatório',
  isDefined: 'é obrigatório',
  isString: 'deve ser um texto',
  isEmail: 'deve ser um e-mail válido',
  isInt: 'deve ser um número inteiro',
  isNumber: 'deve ser um número',
  isNumberString: 'deve ser um número',
  isDecimal: 'deve ser um número decimal',
  isPositive: 'deve ser maior que zero',
  isNegative: 'deve ser menor que zero',
  min: 'está abaixo do mínimo permitido',
  max: 'está acima do máximo permitido',
  isBoolean: 'deve ser verdadeiro ou falso',
  isDate: 'deve ser uma data válida',
  isDateString: 'deve ser uma data válida',
  isISO8601: 'deve ser uma data válida',
  isMilitaryTime: 'deve ser um horário válido (HH:mm)',
  isUUID: 'é um identificador inválido',
  isEnum: 'possui um valor não permitido',
  isIn: 'possui um valor não permitido',
  isNotIn: 'possui um valor não permitido',
  minLength: 'é curto demais',
  maxLength: 'é longo demais',
  length: 'possui tamanho inválido',
  isUrl: 'deve ser uma URL válida',
  isArray: 'deve ser uma lista',
  arrayNotEmpty: 'deve ter pelo menos um item',
  arrayMinSize: 'tem itens de menos',
  arrayMaxSize: 'tem itens demais',
  arrayUnique: 'não pode ter itens repetidos',
  isObject: 'possui um formato inválido',
  isNotEmptyObject: 'é obrigatório',
  matches: 'está em um formato inválido',
  isHexColor: 'deve ser uma cor válida',
  isPhoneNumber: 'deve ser um telefone válido',
  isLatitude: 'deve ser uma latitude válida',
  isLongitude: 'deve ser uma longitude válida',
  whitelistValidation: 'não é permitido',
};

const GENERIC_PHRASE_PT_BR = 'é inválido';

/**
 * class-validator default messages always start with the property path
 * ("title must be…", "property x should not exist", "each value in x…",
 * "nested property x…"). Anything else was written by a DTO author as
 * explicit copy and is returned verbatim.
 */
function isDefaultClassValidatorMessage(message: string, property: string): boolean {
  return (
    message.startsWith(`${property} `) ||
    message.startsWith('property ') ||
    message.startsWith('each value in ') ||
    message.startsWith('nested property ') ||
    message.startsWith('an unknown value was passed')
  );
}

function fieldSubject(path: string): string {
  const leaf = path.split('.').filter((p) => !/^\d+$/.test(p)).pop() ?? path;
  const label = tryGetFieldLabelPtBr(leaf);
  return label ? `O campo "${label}"` : 'Um dos campos';
}

function flatten(errors: ValidationError[], parent = ''): Array<{ path: string; error: ValidationError }> {
  const out: Array<{ path: string; error: ValidationError }> = [];
  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) out.push({ path, error });
    if (error.children?.length) out.push(...flatten(error.children, path));
  }
  return out;
}

/** Builds PT-BR copy for class-validator errors; logs the technical detail. */
export function classValidatorMessagesPtBr(errors: ValidationError[]): string[] {
  const messages: string[] = [];
  for (const { path, error } of flatten(errors)) {
    for (const [constraint, defaultMessage] of Object.entries(error.constraints ?? {})) {
      logger.debug(`[validation] ${path}: ${constraint} — ${defaultMessage}`);
      if (!isDefaultClassValidatorMessage(defaultMessage, error.property)) {
        messages.push(defaultMessage);
        continue;
      }
      const phrase = CONSTRAINT_PHRASES_PT_BR[constraint] ?? GENERIC_PHRASE_PT_BR;
      messages.push(`${fieldSubject(path)} ${phrase}.`);
    }
  }
  return [...new Set(messages)];
}

/** Global ValidationPipe exceptionFactory. */
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    error: 'VALIDATION_FAILED',
    message: classValidatorMessagesPtBr(errors),
  });
}

/** zod issue code → PT-BR predicate. */
function zodPhrasePtBr(issue: ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.received === 'undefined' ? 'é obrigatório' : 'possui um tipo inválido';
    case 'invalid_enum_value':
    case 'invalid_literal':
    case 'invalid_union':
    case 'invalid_union_discriminator':
      return 'possui um valor não permitido';
    case 'too_small':
      return 'está abaixo do mínimo permitido';
    case 'too_big':
      return 'está acima do máximo permitido';
    case 'invalid_string':
      return 'está em um formato inválido';
    case 'invalid_date':
      return 'deve ser uma data válida';
    case 'unrecognized_keys':
      return 'não é permitido';
    default:
      return GENERIC_PHRASE_PT_BR;
  }
}

/**
 * Builds PT-BR copy for zod issues. A `custom` issue carries a message the
 * schema author wrote on purpose and is returned verbatim; every other issue
 * gets PT-BR copy. Technical detail is logged.
 */
export function zodMessagesPtBr(error: ZodError): string[] {
  const messages = error.errors.map((issue) => {
    const path = issue.path.join('.');
    logger.debug(`[validation] ${path || '(root)'}: ${issue.code} — ${issue.message}`);
    if (issue.code === 'custom') return issue.message;
    if (!path) {
      return issue.code === 'unrecognized_keys'
        ? 'Os dados enviados contêm campos não permitidos.'
        : 'Os dados enviados são inválidos.';
    }
    return `${fieldSubject(path)} ${zodPhrasePtBr(issue)}.`;
  });
  return [...new Set(messages)];
}
