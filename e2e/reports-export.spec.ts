import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { XLSX } from './helpers/xlsx';

/**
 * reports-export.spec.ts  (Part 78)
 *
 * Real browser E2E — reproduces and locks in the regression of the
 * "Clientes" export in the Reports Center (/reports): real login → triggers the
 * export → waits for the real download → OPENS the file and validates the content
 * (pt-BR headers, absence of technical/encrypted data). It does not declare
 * success merely because the download happened.
 *
 * Original root cause (fixed in this Part): migration
 * 20260719000010_RebuildClientsInCanonicalFormOrder physically removed the
 * segmento/endereco/responsavel/prioridade/cpf/cnpj columns from `clients`,
 * but `ClientEntity` was never updated — every read generated
 * `QueryFailedError: column "segmento" does not exist` (500).
 *
 * Credentials only via environment variables, never hardcoded — absent ⇒
 * the whole suite is skipped (test.skip), like the login spec in this same
 * folder.
 */
const EMAIL = process.env.E2E_INSTITUTIONAL_EMAIL;
const PASSWORD = process.env.E2E_INSTITUTIONAL_PASSWORD;

test.describe('Reports center — client export', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_INSTITUTIONAL_EMAIL/PASSWORD missing — skipping the real E2E.');

  test('exports clients as a valid XLSX, no 500, no leaked technical data', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await test.step('login institucional real', async () => {
      await page.goto('/auth', { waitUntil: 'networkidle' });
      await page.getByPlaceholder('Digite seu e-mail').fill(EMAIL!);
      await page.getByPlaceholder('Digite sua senha').fill(PASSWORD!);
      await page.getByRole('button', { name: /acessar o sistema/i }).click();
      await page.waitForURL(/\/(dashboard|change-required-password)/, { timeout: 15_000 });
    });

    if (page.url().includes('/change-required-password')) {
      test.skip(true, 'Account is in a forced password change — no stable final password for this E2E.');
    }

    await test.step('opens the reports center', async () => {
      await page.goto('/reports', { waitUntil: 'networkidle' });
      await expect(page.locator('[data-testid="entity-row-clients"]')).toBeVisible({ timeout: 10_000 });
    });

    await test.step('exports clients and validates the real file (opens it and checks the content)', async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15_000 }),
        page.locator('[data-testid="btn-export-clients"]').click(),
      ]);

      expect(download.suggestedFilename()).toMatch(/^clients.*\.xlsx$/);

      const filePath = await download.path();
      expect(filePath).toBeTruthy();
      const buf = fs.readFileSync(filePath!);
      const wb = XLSX.read(buf, { type: 'buffer' });
      expect(wb.SheetNames.length).toBeGreaterThan(0);

      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      expect(rows.length).toBeGreaterThanOrEqual(1); // at least the header

      const header = (rows[0] as string[]).map(String);
      // The header is always pt-BR, never the technical key nor an encrypted/internal column.
      expect(header).toContain('Nome');
      expect(header.some((h) => /_encrypted|tenant_id/i.test(h))).toBe(false);

      expect(pageErrors.filter((e) => /removeChild|500|Internal Server Error/i.test(e))).toEqual([]);
    });
  });
});
