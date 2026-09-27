import { test, expect } from '@playwright/test';

/**
 * crm-timeline-persistence.spec.ts  (Part 80)
 *
 * Real browser E2E — proves that a Contact's Timeline (Contact =
 * Client, physical table `clients`, events persisted in `activity_logs`
 * via /clients/:id/timeline) survives a reload, instead of living only in
 * in-memory React/Zustand state.
 *
 * Real login → opens Contacts → opens the first existing contact → records
 * a clearly identified test note → confirms it appears on
 * screen → reloads the page from scratch → reopens the same contact → confirms
 * the note is STILL there (only possible if it came from the backend, not from local
 * state lost on reload).
 *
 * The note stays recorded permanently (timeline/activity_logs is an
 * immutable history by design — there is no endpoint to delete a
 * timeline entry, on purpose). That is why the note text identifies itself as an
 * automated check, never inventing client data.
 *
 * Credentials only via environment variables — absent ⇒ suite skipped.
 */
const EMAIL = process.env.E2E_INSTITUTIONAL_EMAIL;
const PASSWORD = process.env.E2E_INSTITUTIONAL_PASSWORD;

test.describe('CRM — contact/client timeline survives a reload (real persistence)', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_INSTITUTIONAL_EMAIL/PASSWORD ausentes — pulando E2E real.');

  test('a note recorded on the timeline stays after a full page reload', async ({ page }) => {
    const noteText = `[E2E automatizado — Parte 80] verificação de persistência da timeline ${Date.now()}`;

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

    let contactId = '';

    await test.step('opens contacts and the first existing contact', async () => {
      await page.goto('/leads', { waitUntil: 'networkidle' });
      await page.locator('[data-testid="tab-content-contatos"]').waitFor({ timeout: 10_000 });

      const firstRow = page.locator('[data-testid^="contato-row-"]').first();
      await firstRow.waitFor({ timeout: 10_000 });
      const rowTestId = await firstRow.getAttribute('data-testid');
      contactId = rowTestId!.replace('contato-row-', '');

      await page.locator(`[data-testid="contato-actions-${contactId}"]`).click();
      await page.locator(`[data-testid="contato-action-view-${contactId}"]`).click();
      await expect(page.locator('[data-testid="contato-view-modal"]')).toBeVisible({ timeout: 10_000 });
    });

    await test.step('records a note on the real timeline (persisted in activity_logs)', async () => {
      await expect(page.locator('[data-testid="contato-view-timeline"]')).toBeVisible();
      await page.locator('[data-testid="contato-view-timeline-input"]').fill(noteText);
      await page.locator('[data-testid="contato-view-timeline-add"]').click();
      await expect(page.locator('[data-testid="contato-view-timeline"]')).toContainText(noteText, { timeout: 10_000 });
    });

    await test.step('closes the modal, reloads the page from scratch and reopens the same contact', async () => {
      await page.locator('[data-testid="button-close-view"]').click();
      await page.reload({ waitUntil: 'networkidle' });

      await page.locator('[data-testid="tab-content-contatos"]').waitFor({ timeout: 10_000 });
      await page.locator(`[data-testid="contato-actions-${contactId}"]`).click();
      await page.locator(`[data-testid="contato-action-view-${contactId}"]`).click();
      await expect(page.locator('[data-testid="contato-view-modal"]')).toBeVisible({ timeout: 10_000 });
    });

    await test.step('the note recorded before the reload is still there (proof of real persistence)', async () => {
      await expect(page.locator('[data-testid="contato-view-timeline"]')).toContainText(noteText, { timeout: 10_000 });
    });
  });
});
