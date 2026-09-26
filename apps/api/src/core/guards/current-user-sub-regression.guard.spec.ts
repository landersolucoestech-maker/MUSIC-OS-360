import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Regression guard (Task X): `@CurrentUser()` resolves to `JwtAuth`, whose
 * user-id field is `userId` (populated from `claims.sub` at the guard level —
 * see auth.guard.ts). A controller typed `user: any` reading `user?.sub`
 * silently reads a field that never existed on the returned object, always
 * yielding `undefined`, which blanks `created_by`/`updated_by` audit columns
 * without throwing. Found in 7 controllers during Task X's sweep and fixed by
 * switching to `JwtAuth` typing + `.userId`. This test fails the build the
 * next time the pattern reappears in any controller.
 */

const MODULES_ROOT = join(__dirname, '..', '..', 'modules');

function controllerFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);
    const stats = statSync(absolute);
    if (stats.isDirectory()) files.push(...controllerFiles(absolute));
    else if (/\.controller\.ts$/.test(entry)) files.push(absolute);
  }
  return files;
}

describe('CurrentUser().sub regression guard', () => {
  it('no controller reads .sub from a @CurrentUser() — the correct field is .userId', () => {
    const violations: string[] = [];
    for (const file of controllerFiles(MODULES_ROOT)) {
      const content = readFileSync(file, 'utf8');
      if (/\.sub\b/.test(content)) {
        violations.push(relative(MODULES_ROOT, file));
      }
    }
    expect(violations).toEqual([]);
  });
});
