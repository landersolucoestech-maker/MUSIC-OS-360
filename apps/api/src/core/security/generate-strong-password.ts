/**
 * generate-strong-password.ts  (Part 73, charset revised in Part 75)
 *
 * Generates a strong temporary password for the tenant-zero institutional
 * owner (and any other flow that needs a secure temporary
 * password). Uses `crypto.randomInt` (CSPRNG, not `Math.random()`), guarantees
 * at least one character of each required class, and does not derive from any
 * input data (name, project, date) — each call is independent and
 * unpredictable.
 *
 * Part 75: the original symbol set included `()[]{}"^` — characters that, although
 * not "ambiguous" in the l/O/0/1 sense, are prone to copy/manual typing
 * errors (parentheses/brackets/braces are easy to swap with each other
 * or lose when copying from a chat bubble). Restricted to a set without
 * quotes, backticks, backslashes, spaces or opening/closing pairs.
 *
 * Never log, commit or persist the returned value in plain text for
 * longer than needed to deliver it to the recipient (see
 * bootstrap-tenant-zero.cli.ts, which only prints it on a local interactive stdout,
 * never in a non-interactive/CI run).
 */
import { randomInt } from 'node:crypto';

const LOWER = 'abcdefghijkmnopqrstuvwxyz'; // no "l" (confused with "1"/"I")
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no "O" (confused with "0")
const DIGITS = '23456789'; // sem "0"/"1"
const SYMBOLS = '!@#$%&*+-=?_'; // no quotes/backticks/backslashes/spaces/parentheses/brackets/braces
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

const MIN_LENGTH = 28;

function pick(charset: string): string {
  return charset[randomInt(charset.length)];
}

function shuffle(chars: string[]): string[] {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars;
}

export function generateStrongPassword(length = MIN_LENGTH): string {
  if (length < MIN_LENGTH) {
    throw new Error(`generateStrongPassword: length deve ser >= ${MIN_LENGTH}`);
  }

  const required = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  const rest = Array.from({ length: length - required.length }, () => pick(ALL));

  return shuffle([...required, ...rest]).join('');
}
