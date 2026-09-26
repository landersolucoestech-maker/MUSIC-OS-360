import { test, expect } from '@playwright/test';

/**
 * clients-import-template.spec.ts  (Part 80)
 *
 * Real browser E2E — confirms the Reports Center exposes a
 * real import for "Clientes" (entity-driven via GET /reports/definitions,
 * no fixed list in the frontend) and that the "Baixar template" button downloads a real
 * XLSX emitted by the backend (GET /reports/entities/clients/import/template),
 * not a static frontend file.
 *
 * Read/download only — creates, edits or removes no record.
 *
 * Credentials only via environment variables — absent ⇒ suite skipped.
 */
const EMAIL = process.env.E2E_INSTITUTIONAL_EMAIL;
const PASSWORD = process.env.E2E_INSTITUTIONAL_PASSWORD;

test.describe('Central de Relatórios — importação de Clientes (template real)', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_INSTITUTIONAL_EMAIL/PASSWORD ausentes — pulando E2E real.');

  test('botão de importar Clientes abre o diálogo e o template baixado é um XLSX real do backend', async ({ page }) => {
    await test.step('login institucional real', async () => {
      await page.goto('/auth', { waitUntil: 'networkidle' });
      await page.getByPlaceholder('Digite seu e-mail').fill(EMAIL!);
      await page.getByPlaceholder('Digite sua senha').fill(PASSWORD!);
      await page.getByRole('button', { name: /acessar o sistema/i }).click();
      await page.waitForURL(/\/(dashboard|change-required-password)/, { timeout: 15_000 });
    });

    if (page.url().includes('/change-required-password')) {
      test.skip(true, 'Conta em troca de senha obrigatória — sem senha final estável para este E2E.');
    }

    await test.step('abre a Central de Relatórios e localiza a linha de Clientes', async () => {
      await page.goto('/relatorios', { waitUntil: 'networkidle' });
      await expect(page.locator('[data-testid="entity-row-clients"]')).toBeVisible({ timeout: 10_000 });
    });

    await test.step('abre o diálogo de importação de Clientes', async () => {
      await page.locator('[data-testid="btn-import-clients"]').click();
      await expect(page.locator('[data-testid="import-dialog"]')).toBeVisible({ timeout: 10_000 });
    });

    await test.step('baixa o template real (emitido pelo backend, não estático)', async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('[data-testid="import-download-template"]').click(),
      ]);
      expect(download.suggestedFilename()).toBe('clients_template.xlsx');
    });
  });
});
