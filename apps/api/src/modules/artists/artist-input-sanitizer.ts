/**
 * artist-input-sanitizer.ts — SEC-F1 (security review of bc40b76).
 *
 * `metadata` is only @IsObject on the DTO, but the response returns the
 * allow-listed metadata keys (ARTIST_METADATA_ONLY_FIELDS: instagram_url,
 * tiktok_url, gender, platform metrics) straight from the stored jsonb. A
 * caller-supplied `metadata.instagram_url = "javascript:..."` would therefore
 * bypass the DTO URL patterns and be rendered as an `href` by the web.
 *
 * Every allow-listed key coming in through `metadata` is re-validated with the
 * SAME CreateArtistDto rules as its top-level field (single source: the DTO
 * decorators) and dropped when invalid. The reports import applies the same DTO
 * rules to the URL-ish columns (artistUrlFieldViolations).
 */
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateArtistDto } from './dto/create-artist.dto';
import { ARTIST_METADATA_ONLY_FIELDS } from './artist-legacy-fields';

/** Artist fields whose value the web renders as a link/image source (href/src). */
export const ARTIST_URL_FIELDS = [
  'photo_url', 'gallery_urls', 'documents', 'personal_documents_url', 'press_kit_url',
  'spotify_url', 'youtube_url', 'deezer_url', 'apple_music_url', 'soundcloud_url',
  'instagram_url', 'tiktok_url',
] as const;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Keys of `values` (restricted to `keys`) that fail the CreateArtistDto validation of the same property. */
function invalidDtoProperties(values: Record<string, unknown>, keys: readonly string[]): Set<string> {
  const probe: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(values, key)) probe[key] = values[key];
  }
  if (Object.keys(probe).length === 0) return new Set();
  const errors = validateSync(plainToInstance(CreateArtistDto, probe));
  return new Set(errors.map((error) => error.property).filter((property) => property in probe));
}

/**
 * BLK-CRM-PII-PLAINTEXT: personal/bank/contact keys (canonical and pre-CZ-042 spellings) that must never be
 * persisted in plaintext inside `artists.metadata`. Their values live in the encrypted columns
 * (`<field>_encrypted`); a caller-supplied metadata key of this kind is dropped, never persisted.
 * Matched case-insensitively ('-' and ' ' treated as '_').
 */
export const ARTIST_METADATA_PII_KEYS: ReadonlySet<string> = new Set([
  'cpf', 'cnpj', 'cpf_cnpj', 'documento', 'document', 'rg',
  'birth_date', 'data_nascimento', 'address', 'endereco',
  'bank_name', 'banco', 'bank_branch', 'agencia', 'bank_account', 'conta',
  'pix_key', 'chave_pix', 'account_holder', 'titular_conta',
  'email', 'e_mail', 'phone', 'telefone', 'celular', 'manager_contact', 'manager_contato',
]);
const normalizeMetadataKey = (key: string): string => key.trim().toLowerCase().replace(/[-\s]+/g, '_');

/**
 * Caller-supplied artist metadata with every allow-listed response key that
 * fails its top-level DTO rule removed, plus every plaintext PII key (ARTIST_METADATA_PII_KEYS) (e.g. `instagram_url: "javascript:..."`,
 * `tiktok_url: "data:text/html,..."`, a non-numeric metric). Other keys are
 * kept untouched (they are never returned by the API).
 */
export function sanitizeArtistMetadataInput(value: unknown): unknown {
  if (!isPlainObject(value)) return value;
  const out = { ...value };
  for (const key of Object.keys(out)) {
    if (ARTIST_METADATA_PII_KEYS.has(normalizeMetadataKey(key))) delete out[key];
  }
  for (const key of invalidDtoProperties(out, ARTIST_METADATA_ONLY_FIELDS)) delete out[key];
  return out;
}

/** URL-ish artist fields in `values` that fail the CreateArtistDto rule (http(s) only / platform pattern). */
export function artistUrlFieldViolations(values: Record<string, unknown>): string[] {
  const invalid = invalidDtoProperties(values, ARTIST_URL_FIELDS);
  return ARTIST_URL_FIELDS.filter((key) => invalid.has(key));
}
