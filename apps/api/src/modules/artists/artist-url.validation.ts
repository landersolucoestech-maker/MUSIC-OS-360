/**
 * artist-url.validation.ts — single http(s)-only rule for every URL-ish artist
 * field (SEC-F1, security review of bc40b76).
 *
 * The web renders these values as `href`/`src` (photo, gallery, press kit,
 * documents, social links). React does not block `javascript:`/`data:` URLs,
 * so the API is the authoritative boundary: only absolute http:// or https://
 * URLs are accepted. `require_tld: false` keeps local/dev storage hosts
 * (http://localhost:54321/...) valid; the protocol allow-list is what matters.
 */
import { ValidateBy, buildMessage, isURL, type ValidationOptions } from 'class-validator';

const HTTP_URL_OPTIONS: NonNullable<Parameters<typeof isURL>[1]> = {
  protocols: ['http', 'https'], require_protocol: true, require_tld: false,
};

export const HTTP_URL_MESSAGE = 'Informe um link válido começando com http:// ou https://.';

/** True only for an absolute http(s) URL (whitespace, `javascript:`, `data:` and relative URLs are rejected). */
export function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && isURL(value, HTTP_URL_OPTIONS);
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
