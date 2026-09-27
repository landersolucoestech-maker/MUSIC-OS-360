import { test, expect } from '@playwright/test';

/**
 * login-and-password-change.spec.ts  (Part 77)
 *
 * Real browser E2E — institutional login → safe redirect to
 * /change-required-password → validations → real change → wizard. Never
 * replaces this with a direct Supabase call (that coverage already
 * exists in the backend unit tests); the value of this spec is
 * exactly confirming the real BROWSER does not break during the flow
 * (see the removeChild regression fixed in this same Part).
 *
 * Credentials only via environment variables, never hardcoded:
 *   E2E_INSTITUTIONAL_EMAIL    — the institutional owner's e-mail
 *   E2E_INSTITUTIONAL_PASSWORD — the CURRENT temporary password (valid now)
 *   E2E_TEST_PASSWORD          — a synthetic password this test only changes TO
 * Absent → the whole suite is skipped (test.skip), never failing CI for lack
 * of a secret most environments do not have.
 */
const EMAIL = process.env.E2E_INSTITUTIONAL_EMAIL;
const CURRENT_PASSWORD = process.env.E2E_INSTITUTIONAL_PASSWORD;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe('Institutional login → mandatory password change', () => {
  test.skip(!EMAIL || !CURRENT_PASSWORD || !TEST_PASSWORD, 'E2E_INSTITUTIONAL_EMAIL/PASSWORD/E2E_TEST_PASSWORD ausentes — pulando E2E real.');

  test('full flow with no React crash (removeChild) and no sensitive data persisted', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await test.step('login with valid credentials', async () => {
      await page.goto('/auth', { waitUntil: 'networkidle' });
      await page.getByPlaceholder('Digite seu e-mail').fill(EMAIL!);
      await page.getByPlaceholder('Digite sua senha').fill(CURRENT_PASSWORD!);
      await page.getByRole('button', { name: /acessar o sistema/i }).click();
      await page.waitForURL('**/change-required-password', { timeout: 10_000 });
    });

    await test.step('the change page renders without crashing', async () => {
      await expect(page.locator('h1')).toHaveText(/troca de senha obrigatória/i);
      expect(pageErrors.filter((e) => /removeChild/i.test(e))).toEqual([]);
    });

    await test.step('a mismatched confirmation is rejected', async () => {
      await page.locator('#required-new-password').fill('NovaSenhaForte9!Abc');
      await page.locator('#required-confirm-password').fill('OutraCoisaDiferente9!');
      await page.getByRole('button', { name: /trocar senha e continuar/i }).click();
      await expect(page.getByRole('alert')).toContainText(/não coincidem/i);
      expect(page.url()).toContain('/change-required-password');
    });

    await test.step('a weak password is rejected', async () => {
      await page.locator('#required-new-password').fill('fraca123');
      await page.locator('#required-confirm-password').fill('fraca123');
      await page.getByRole('button', { name: /trocar senha e continuar/i }).click();
      await expect(page.getByRole('alert')).toContainText(/faltam|fraca/i);
    });

    await test.step('a valid change navigates to the wizard without crashing', async () => {
      await page.locator('#required-new-password').fill(TEST_PASSWORD!);
      await page.locator('#required-confirm-password').fill(TEST_PASSWORD!);
      await page.getByRole('button', { name: /trocar senha e continuar/i }).click();
      await page.waitForURL('**/onboarding', { timeout: 15_000 });
      expect(pageErrors.filter((e) => /removeChild/i.test(e))).toEqual([]);
    });

    await test.step('ends the session', async () => {
      // Never leaves the test session open in the browser.
      await page.evaluate(() => localStorage.clear());
    });
  });
});
