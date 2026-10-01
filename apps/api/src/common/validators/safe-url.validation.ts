/**
 * safe-url.validation.ts — shared URL rules for every API field the web binds to
 * `href`/`src` (SEC1 / find-77526160, extends SEC-F1 of the artist module).
 *
 * React does not block `javascript:`/`data:` URLs, so the API is the first
 * boundary (the web's shared/lib/safe-url.ts is the second): only absolute
 * http(s) URLs, or the app's own `r2://<bucket>/<key>` storage reference for
 * uploads (never executable; the web opens it through the signed download),
 * are accepted. `require_tld: false` keeps local/dev storage hosts
 * (http://localhost:54321/...) valid; the protocol allow-list is what matters.
 */
import { ValidateBy, buildMessage, isURL, type ValidationOptions } from 'class-validator';

export const MAX_URL_LENGTH = 2048;

const HTTP_URL_OPTIONS: NonNullable<Parameters<typeof isURL>[1]> = {
  protocols: ['http', 'https'], require_protocol: true, require_tld: false,
};

export const HTTP_URL_MESSAGE = 'Informe um link válido começando com http:// ou https://.';
export const HTTP_OR_STORAGE_URL_MESSAGE = 'Informe um link válido começando com http:// ou https:// (ou um arquivo enviado pelo sistema).';
export const SAFE_URL_VALUE_MESSAGE = 'Um dos links informados é inválido: use apenas http://, https:// ou um arquivo enviado pelo sistema.';

const STORAGE_REF = /^r2:\/\/[A-Za-z0-9][A-Za-z0-9._-]*\/[^\s<>"'`\\]+$/;
// Characters browsers drop or ignore inside/around a scheme (tab, LF, CR, spaces, C0/DEL, NBSP, zero-width, BOM).
// eslint-disable-next-line no-control-regex
const SCHEME_NOISE = /[\u0000-\u0020\u007f\u00a0\u1680\u180e\u2000-\u200d\u2028\u2029\u202f\u205f\u2060\u3000\ufeff]/g;
// A leading `name:` is a scheme, unless it is a `host:port` (digits then `/`, `?`, `#` or the end)
// whose name looks like a host (contains a dot, or is `localhost`). Dangerous scheme names are never
// host:port, so `javascript:1/alert(1)` stays a scheme.
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const HOST_PORT_TAIL = /^\d+(?:[/?#]|$)/;
const DANGEROUS_SCHEMES = new Set(['javascript', 'data', 'vbscript', 'file', 'blob', 'about']);

function looksLikeHostPort(name: string, rest: string): boolean {
  if (DANGEROUS_SCHEMES.has(name)) return false;
  if (!HOST_PORT_TAIL.test(rest)) return false;
  return name === 'localhost' || name.includes('.');
}

/** True only for an absolute http(s) URL (whitespace, `javascript:`, `data:` and relative URLs are rejected). */
export function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_URL_LENGTH && isURL(value, HTTP_URL_OPTIONS);
}

/** `r2://bucket/key`: the reference an upload gets while no public R2 URL is configured. */
export function isStorageRef(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_URL_LENGTH && STORAGE_REF.test(value);
}

/** Absolute http(s) URL or storage reference. */
export function isHttpOrStorageUrl(value: unknown): value is string {
  return isHttpUrl(value) || isStorageRef(value);
}

/**
 * Lenient rule for free-form text that may hold a link (JSON values, a bare
 * `example.com/x`): refuses only what a browser could execute or redirect
 * through — any scheme other than http/https/r2 (also when obfuscated with
 * whitespace/control characters or percent-free case tricks), `//host` and
 * `\\host` network-path references, and over-long values.
 */
export function isSafeUrlText(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length > MAX_URL_LENGTH) return false;
  const compact = value.replace(SCHEME_NOISE, '');
  if (/^[/\\]{2}/.test(compact)) return false;
  const scheme = SCHEME.exec(compact);
  if (!scheme) return true;
  const name = scheme[1].toLowerCase();
  if (looksLikeHostPort(name, compact.slice(scheme[0].length))) return true;
  if (name === 'r2') return isStorageRef(value.trim());
  return (name === 'http' || name === 'https') && isHttpUrl(value.trim());
}

/**
 * Optional http(s) URL. An empty string means "blank input" (a pre-CZ-042 web
 * build sends '' for an empty field) and is accepted; any non-empty value must
 * be an absolute http(s) URL. Use `{ each: true }` for string arrays.
 */
export function IsHttpUrl(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isHttpUrl',
      validator: {
        validate: (value: unknown) => value === '' || isHttpUrl(value),
        defaultMessage: buildMessage(() => HTTP_URL_MESSAGE, validationOptions),
      },
    },
    validationOptions,
  );
}

/** Like IsHttpUrl, but a storage reference (`r2://bucket/key`, an upload) is accepted too. */
export function IsHttpOrStorageUrl(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isHttpOrStorageUrl',
      validator: {
        validate: (value: unknown) => value === '' || isHttpOrStorageUrl(value),
        defaultMessage: buildMessage(() => HTTP_OR_STORAGE_URL_MESSAGE, validationOptions),
      },
    },
    validationOptions,
  );
}

/** Link-ish text (see isSafeUrlText): a bare host is fine, an executable/redirecting scheme is not. */
export function IsSafeUrlText(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isSafeUrlText',
      validator: {
        validate: (value: unknown) => value === '' || isSafeUrlText(value),
        defaultMessage: buildMessage(() => SAFE_URL_VALUE_MESSAGE, validationOptions),
      },
    },
    validationOptions,
  );
}

/**
 * Array of objects whose `key` (when present and non-blank) must be an http(s)
 * URL — e.g. `documents: [{ name, url }]`.
 */
export function HasHttpUrlItems(key: string, validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'hasHttpUrlItems',
      validator: {
        validate: (value: unknown) => {
          if (!Array.isArray(value)) return true; // shape is checked by @IsArray
          return value.every((item) => {
            if (item === null || typeof item !== 'object' || Array.isArray(item)) return true;
            const url = (item as Record<string, unknown>)[key];
            return url === undefined || url === null || url === '' || isHttpUrl(url);
          });
        },
        defaultMessage: buildMessage(() => HTTP_URL_MESSAGE, validationOptions),
      },
    },
    validationOptions,
  );
}

/** JSON keys whose value the web binds to href/src: url, fileUrl, audio_url, link, previewUrl, hrefs, srcs, uri, website, avatar, image, cover, thumbnail, download… */
const URL_KEY = /(^|[_-])(url|link|href|src)s?$|[a-z](Url|Link|Href|Src)s?$/i;
// Other keys that hold a link in practice (S2-2): matched case-insensitively on the key's last word.
const URL_KEY_NOUNS = /(^|[_-]|[a-z])(uri|website|avatar|image|photo|picture|logo|cover|thumbnail|thumb|download|permalink)s?$/i;
const MAX_JSON_DEPTH = 6;
// Value-based rule for ANY key (SEC3 F-SEC-U1): a string that a browser would read as an executable
// scheme. Browsers drop tab/LF/CR anywhere and leading C0/space; internal spaces are kept.
// eslint-disable-next-line no-control-regex
const LEADING_NOISE = /^[\u0000-\u0020\u007f\u00a0\u1680\u180e\u2000-\u200d\u2028\u2029\u202f\u205f\u2060\u3000\ufeff]+/;
const EXECUTABLE_SCHEME = /^(javascript|data|vbscript):/i;

/** True when `value` starts (after browser normalisation) with javascript:, data: or vbscript:. */
export function hasExecutableScheme(value: string): boolean {
  return EXECUTABLE_SCHEME.test(value.replace(/[\t\n\r]/g, '').replace(LEADING_NOISE, ''));
}

/** True when every url-ish key anywhere in `value` (objects/arrays, bounded depth) holds a safe link. */
export function hasSafeUrlValues(value: unknown, depth = 0): boolean {
  if (depth > MAX_JSON_DEPTH) return false;
  if (typeof value === 'string') return !hasExecutableScheme(value);
  if (Array.isArray(value)) return value.every((item) => hasSafeUrlValues(item, depth + 1));
  if (value === null || typeof value !== 'object') return true;
  return Object.entries(value as Record<string, unknown>).every(([key, item]) => {
    if (URL_KEY.test(key) || URL_KEY_NOUNS.test(key)) {
      if (item === null || item === undefined || item === '') return true;
      if (Array.isArray(item)) return item.every((entry) => entry === null || entry === '' || (typeof entry === 'string' ? isSafeUrlText(entry) : hasSafeUrlValues(entry, depth + 1)));
      if (typeof item === 'object') return hasSafeUrlValues(item, depth + 1);
      return isSafeUrlText(item);
    }
    return hasSafeUrlValues(item, depth + 1);
  });
}

/** Free-form JSON (assets, metadata, tracks, participants…): its url-ish keys must hold safe links. */
export function HasSafeUrlValues(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'hasSafeUrlValues',
      validator: {
        validate: (value: unknown) => hasSafeUrlValues(value),
        defaultMessage: buildMessage(() => SAFE_URL_VALUE_MESSAGE, validationOptions),
      },
    },
    validationOptions,
  );
}
