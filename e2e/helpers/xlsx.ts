import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Single resolution point for the `xlsx` library in the root e2e suite.
 *
 * `xlsx` is a dependency of the web workspace (apps/web), not of the root
 * manifest, and the root has no hoisting. Resolving it anchored at
 * apps/web/package.json keeps the root manifest and the lockfile unchanged.
 *
 * Only used to read workbooks that the specs themselves downloaded from the
 * local stack (trusted test artifacts), never untrusted uploads.
 */
const webRequire = createRequire(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps', 'web', 'package.json'));

export const XLSX: typeof import('../../apps/web/node_modules/xlsx') = webRequire('xlsx');
