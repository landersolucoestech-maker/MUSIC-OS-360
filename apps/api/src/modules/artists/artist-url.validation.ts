/**
 * artist-url.validation.ts — the artist module's URL rules now live in the shared
 * common/validators/safe-url.validation.ts (SEC-F1, extended by SEC1); re-exported
 * here so existing imports keep working.
 */
export { HTTP_URL_MESSAGE, HasHttpUrlItems, IsHttpUrl, isHttpUrl } from '../../common/validators/safe-url.validation';
