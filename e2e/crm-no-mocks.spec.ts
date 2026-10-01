import { test, expect } from '@playwright/test';

/**
 * crm-no-mocks.spec.ts  (Part 79)
 *
 * Real browser E2E — locks in the regression of the CRM/Leads mocks
 * eliminated in this Part. Real login → opens /leads (CRM) → confirms the
 * page actually calls the real endpoints (/leads, /clients) and that the
 * fictitious names of the old in-memory mock (`Marina Torres`, `Rafael Azevedo`,
 * `Casa Aurora`, `Beat Press`, `João Silva`, `Maria Santos`, `Pedro Costa`) NEVER appear
 * on screen — the only way they could appear is if the code went back to using the
 * static array instead of the real backend.
 *
 * Credentials only via environment variables — absent ⇒ suite skipped.
 */
const EMAIL = process.env.E2E_INSTITUTIONAL_EMAIL;
const PASSWORD = process.env.E2E_INSTITUTIONAL_PASSWORD;

const MOCK_NAMES = [
  'Marina Torres', 'Rafael Azevedo', 'Mavi Music', 'Azul Eventos',
  'Casa Aurora', 'Beat Press', 'João Silva', 'Maria Santos', 'Pedro Costa',
  'Aurora Live',
];

test.describe('CRM (leads/contacts) — no mocked data', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_INSTITUTIONAL_EMAIL/PASSWORD ausentes — pulando E2E real.');

  test('loads leads/contacts through the real API, with none of the old mock names', async ({ page }) => {
    const apiCalls: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/v1/leads') || url.includes('/api/v1/clients')) apiCalls.push(url);
    });
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

    await test.step('opens the CRM (contacts tab) and confirms a real backend call', async () => {
      await page.goto('/leads', { waitUntil: 'networkidle' });
      await expect(page.locator('[data-testid="tab-content-contacts"]')).toBeVisible({ timeout: 10_000 });
      expect(apiCalls.some((u) => u.includes('/api/v1/clients'))).toBe(true);
    });

    await test.step('opens the leads tab and confirms a real backend call', async () => {
      await page.locator('[data-testid="tab-leads"]').click();
      await expect(page.locator('[data-testid="tab-content-leads"]')).toBeVisible({ timeout: 10_000 });
      expect(apiCalls.some((u) => u.includes('/api/v1/leads'))).toBe(true);
    });

    await test.step('no name from the old in-memory mock appears on screen', async () => {
      const bodyText = await page.locator('body').innerText();
      for (const name of MOCK_NAMES) {
        expect(bodyText).not.toContain(name);
      }
    });

    expect(pageErrors.filter((e) => /removeChild/i.test(e))).toEqual([]);
  });
});
