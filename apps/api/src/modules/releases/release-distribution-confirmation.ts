import { BadRequestException } from '@nestjs/common';

/**
 * A Release is Distributed only with a real confirmation: either the distributor confirmed it, or the operation was
 * concluded manually and that conclusion is registered with its evidence. The platform never marks a release as
 * distributed on its own and never invents a confirmation: the person who confirms supplies the origin, the reference
 * (protocol, ticket or link at the distributor) and the date; the server stamps who recorded it and when.
 */
export const DISTRIBUTION_CONFIRMATION_SOURCES = ['external_confirmation', 'manual_operational'] as const;
export type DistributionConfirmationSource = (typeof DISTRIBUTION_CONFIRMATION_SOURCES)[number];

export interface DistributionConfirmation {
  source: DistributionConfirmationSource;
  reference: string;
  /** Day the distribution was confirmed (YYYY-MM-DD). */
  confirmed_at: string;
  note?: string;
  /** Stamped by the server from the authenticated actor; a client value is ignored. */
  confirmed_by: string;
  /** Stamped by the server; a client value is ignored. */
  recorded_at: string;
}

/** The metadata key that holds the confirmation of a distributed release. */
export const DISTRIBUTION_CONFIRMATION_KEY = 'distribution_confirmation';

const MIN_REFERENCE = 3;
const MAX_REFERENCE = 500;
const MAX_NOTE = 1000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Validates what the person supplied and returns the record to store; throws a 400 naming each invalid field. */
export function buildDistributionConfirmation(input: unknown, actorId: string, now: Date = new Date()): DistributionConfirmation {
  const raw = input != null && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const fields: string[] = [];

  const source = raw['source'];
  if (typeof source !== 'string' || !(DISTRIBUTION_CONFIRMATION_SOURCES as readonly string[]).includes(source)) fields.push('source');

  const reference = typeof raw['reference'] === 'string' ? raw['reference'].trim() : '';
  if (reference.length < MIN_REFERENCE || reference.length > MAX_REFERENCE) fields.push('reference');

  let confirmedAt = '';
  const day = typeof raw['confirmed_at'] === 'string' ? raw['confirmed_at'].trim().slice(0, 10) : '';
  const parsed = DAY.test(day) ? new Date(`${day}T00:00:00.000Z`) : null;
  const tomorrow = now.getTime() + 24 * 60 * 60 * 1000;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day || parsed.getTime() > tomorrow) {
    fields.push('confirmed_at');
  } else {
    confirmedAt = day;
  }

  let note: string | undefined;
  if (raw['note'] != null && raw['note'] !== '') {
    if (typeof raw['note'] !== 'string' || raw['note'].trim().length > MAX_NOTE) fields.push('note');
    else note = raw['note'].trim();
  }

  if (fields.length > 0) {
    throw new BadRequestException({
      code: 'RELEASE_DISTRIBUTION_CONFIRMATION_INVALID',
      message: 'Para marcar o lançamento como distribuído, registre a confirmação: origem, referência (protocolo, ticket ou link da distribuidora) e data.',
      fields,
    });
  }

  return {
    source: source as DistributionConfirmationSource,
    reference,
    confirmed_at: confirmedAt,
    ...(note ? { note } : {}),
    confirmed_by: actorId,
    recorded_at: now.toISOString(),
  };
}
