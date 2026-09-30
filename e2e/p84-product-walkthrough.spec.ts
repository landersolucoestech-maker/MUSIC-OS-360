import { test, expect } from '@playwright/test';

/**
 * p84-product-walkthrough.spec.ts  (Part 84)
 *
 * Real functional sweep via the browser: login → walks through the modules
 * visible in the menu → records console errors, 5xx requests and empty bodies
 * per route. It does not replace the focused specs (crm-timeline-persistence etc.);
 * the value here is finding broad visual/functional regressions quickly.
 *
 * Credentials only via environment variables, never hardcoded — absent ⇒
 * suite skipped (same pattern as the other specs in e2e/).
 *   E2E_QA_EMAIL / E2E_QA_PASSWORD — a disposable synthetic account (not the
 *   institutional one).
 */
const EMAIL = process.env.E2E_QA_EMAIL;
const PASSWORD = process.env.E2E_QA_PASSWORD;

const MODULES: Array<{ name: string; path: string }> = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Artistas', path: '/artists' },
  { name: 'Catálogo (Obras/Fonogramas)', path: '/music-registration' },
  { name: 'Lançamentos', path: '/releases' },
  { name: 'Contratos', path: '/contracts' },
  { name: 'Audiovisual', path: '/audiovisual' },
  { name: 'Financeiro', path: '/accounting' },
  { name: 'Contabilidade', path: '/accounting/profit-and-loss' },
  { name: 'Agenda', path: '/agenda' },
  { name: 'Inventário', path: '/inventory' },
  { name: 'MusicChat', path: '/chat' },
  { name: 'CRM (Leads/Contatos)', path: '/leads' },
  { name: 'RH', path: '/hr' },
  { name: 'Marketing', path: '/marketing' },
  { name: 'Relatórios', path: '/reports' },
  { name: 'Suporte', path: '/support' },
  { name: 'Configurações', path: '/settings' },
];

interface ModuleFinding {
  name: string;
  path: string;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  bodyEmpty: boolean;
}

test.describe('Part 84 — functional product sweep', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_QA_EMAIL/E2E_QA_PASSWORD ausentes — pulando varredura real.');

  test('real login + visits every visible module, recording real bugs', async ({ page }) => {
    test.setTimeout(5 * 60_000); // 17 modules with networkidle — the 30s default is too short

    await test.step('login with a synthetic account', async () => {
      await page.goto('/auth', { waitUntil: 'networkidle' });
      await page.getByPlaceholder('Digite seu e-mail').fill(EMAIL!);
      await page.getByPlaceholder('Digite sua senha').fill(PASSWORD!);
      await page.getByRole('button', { name: /acessar o sistema/i }).click();
      await page.waitForURL(/\/(dashboard|onboarding|change-required-password)/, { timeout: 15_000 });
    });

    if (page.url().includes('/change-required-password') || page.url().includes('/onboarding')) {
      throw new Error(`Login desviou para fluxo inesperado: ${page.url()}`);
    }

    const findings: ModuleFinding[] = [];

    for (const mod of MODULES) {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      const failedRequests: string[] = [];

      const onConsole = (msg: import('@playwright/test').ConsoleMessage) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
      };
      const onPageError = (err: Error) => pageErrors.push((err.stack ?? err.message).slice(0, 1500));
      const onResponse = (res: import('@playwright/test').Response) => {
        if (res.status() >= 500) failedRequests.push(`${res.status()} ${res.request().method()} ${res.url()}`);
      };

      page.on('console', onConsole);
      page.on('pageerror', onPageError);
      page.on('response', onResponse);

      let bodyEmpty = false;
      try {
        await page.goto(mod.path, { waitUntil: 'networkidle', timeout: 20_000 });
        await page.waitForTimeout(800); // lets late requests/skeletons settle
        const bodyText = (await page.locator('body').innerText()).trim();
        bodyEmpty = bodyText.length < 10;
      } catch (err) {
        pageErrors.push(`goto/timeout: ${(err as Error).message.slice(0, 300)}`);
      }

      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('response', onResponse);

      findings.push({ name: mod.name, path: mod.path, consoleErrors, pageErrors, failedRequests, bodyEmpty });
    }

    await page.evaluate(() => localStorage.clear());

    const broken = findings.filter(
      (f) => f.pageErrors.length > 0 || f.failedRequests.length > 0 || f.bodyEmpty,
    );

    console.log('\n=== P84 WALKTHROUGH REPORT ===');
    for (const f of findings) {
      const status = f.pageErrors.length || f.failedRequests.length || f.bodyEmpty ? 'BROKEN' : 'OK';
      console.log(`[${status}] ${f.name} (${f.path})`);
      if (f.pageErrors.length) console.log(`  pageErrors: ${JSON.stringify(f.pageErrors)}`);
      if (f.failedRequests.length) console.log(`  failedRequests: ${JSON.stringify(f.failedRequests)}`);
      if (f.bodyEmpty) console.log(`  bodyEmpty: true`);
      if (f.consoleErrors.length) console.log(`  consoleErrors (${f.consoleErrors.length}): ${JSON.stringify(f.consoleErrors.slice(0, 3))}`);
    }
    console.log('=== END REPORT ===\n');

    expect(broken, `Módulos com bug real reproduzido: ${JSON.stringify(broken.map((b) => b.name))}`).toEqual([]);
  });

  test('create a synthetic artist, reload, confirm real persistence', async ({ page }) => {
    test.setTimeout(60_000);
    const nome = `QA P84 Artista ${Date.now()}`;

    await page.goto('/auth', { waitUntil: 'networkidle' });
    await page.getByPlaceholder('Digite seu e-mail').fill(EMAIL!);
    await page.getByPlaceholder('Digite sua senha').fill(PASSWORD!);
    await page.getByRole('button', { name: /acessar o sistema/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    let created400Body: string | null = null;
    page.on('response', async (res) => {
      if (res.url().includes('/api/v1/artists') && res.request().method() === 'POST' && res.status() === 400) {
        created400Body = await res.text().catch(() => null);
      }
    });

    await page.goto('/artists', { waitUntil: 'networkidle' });
    await page.getByTestId('button-novo-artista').click();
    await page.getByTestId('input-stage-name').fill(nome);
    await page.getByTestId('input-legal-name').fill(nome);
    await page.getByTestId('button-save-modal').click();
    await page.waitForTimeout(1000);
    if (created400Body) throw new Error(`POST /artists 400: ${created400Body}`);
    await expect(page.getByText(nome).first()).toBeVisible({ timeout: 10_000 });

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText(nome).first()).toBeVisible({ timeout: 10_000 });

    await page.evaluate(() => localStorage.clear());
  });
});
