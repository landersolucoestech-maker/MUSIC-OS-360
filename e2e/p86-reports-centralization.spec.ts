import { test, expect, type Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

/**
 * p86-reports-centralization.spec.ts  (Part 86)
 *
 * Import/Export must exist ONLY on the Reports page — no
 * module may have its own button. Runs with AUTH_DISABLED=true (dev), without login.
 */
const MODULES_WITHOUT_IMPORT_EXPORT: Array<{ name: string; path: string }> = [
  { name: 'Projetos', path: '/projetos' },
  { name: 'Catálogo (RegistroMusicas)', path: '/registro-musicas' },
  { name: 'RH', path: '/rh' },
  { name: 'Lançamentos', path: '/lancamentos' },
  { name: 'Inventário', path: '/inventario' },
  { name: 'Contratos', path: '/contratos' },
  { name: 'Contabilidade', path: '/accounting/contabilidade' },
];

async function assertNoImportExportButtons(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  // Waits for something real to have rendered (not just the loading skeleton) before
  // asserting absence — otherwise "0 buttons" might only mean "page
  // still loading", a false confidence.
  await expect(page.locator('table, [role="table"], main, [data-testid$="-loading"]').first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  const importBtn = page.locator('[data-testid*="import" i], [data-testid*="importar" i]');
  const exportBtn = page.locator('[data-testid*="export" i], [data-testid*="exportar" i]');
  await expect(importBtn, `${path}: nenhum botão de import deveria existir`).toHaveCount(0);
  await expect(exportBtn, `${path}: nenhum botão de export deveria existir`).toHaveCount(0);
}

test.describe('Parte 86 — centralização de Importar/Exportar em Relatórios', () => {
  for (const mod of MODULES_WITHOUT_IMPORT_EXPORT) {
    test(`${mod.name}: sem botão Importar/Exportar próprio`, async ({ page }) => {
      await assertNoImportExportButtons(page, mod.path);
    });
  }

  test('Relatórios: sem abas/seções (estrutura da página)', async ({ page }) => {
    await page.goto('/relatorios', { waitUntil: 'networkidle' });
    // The whole page is a single list (no <Tabs>) — confirms the structural
    // absence of any tab.
    await expect(page.locator('[role="tab"], [role="tablist"]')).toHaveCount(0);
  });

  test('Relatórios: Formulários e Pipelines NÃO aparecem como entidade (Parte 87 — removidas do registry, não apenas de uma aba)', async ({ page }) => {
    await page.goto('/relatorios', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="entity-row-projects"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="entity-row-forms"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="entity-row-pipelines"]')).toHaveCount(0);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/\bFormulários\b/);
    expect(bodyText).not.toMatch(/\bPipelines?\b/);
  });

  test('Relatórios: entidades fora do registry fechado (Parte 89) NÃO aparecem — nenhum fallback heurístico', async ({ page }) => {
    await page.goto('/relatorios', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="entity-row-projects"]')).toBeVisible({ timeout: 10_000 });

    // Outside the 22 authorized modules (Block 2) — includes the technical entities
    // and those that do not yet have a contract/authorization to appear in Reports.
    const removedTables = [
      'artist_goals', 'assets', 'audiovisual_assets', 'audiovisual_deliverables',
      'audiovisual_tasks', 'lead_interactions', 'marketing_assets',
      'marketing_projects', 'marketing_strategies', 'operational_tasks',
      'pipeline_opportunities', 'support_tickets', 'contract_templates',
    ];
    for (const table of removedTables) {
      await expect(page.locator(`[data-testid="entity-row-${table}"]`)).toHaveCount(0);
    }

    const removedLabels = [
      'Metas de artistas', 'Ativos digitais', 'Ativos audiovisuais', 'Entregáveis audiovisuais',
      'Tarefas audiovisuais', 'Interações de leads', 'Ativos de marketing',
      'Projetos de marketing', 'Estratégias de marketing', 'Tarefas operacionais',
      'Oportunidades de pipeline', 'Chamados de suporte', 'Modelos de contrato',
    ];
    const bodyText = await page.locator('body').innerText();
    for (const label of removedLabels) expect(bodyText).not.toContain(label);
  });

  test('Relatórios: lista exata e ordem exata dos 22 módulos autorizados (Bloco 2/31)', async ({ page }) => {
    await page.goto('/relatorios', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="entity-row-projects"]')).toBeVisible({ timeout: 10_000 });

    const expectedOrderedLabels = [
      'Artistas', 'Projetos', 'Obras', 'Fonogramas', 'Monitoramento', 'Licenciamento',
      'Takedowns', 'Distribuição', 'Shares', 'Contratos', 'Projetos Audiovisuais',
      'Transações Financeiras', 'Contabilidade', 'Nota Fiscal', 'Agenda', 'Inventário',
      'CRM — Contatos', 'CRM — Leads', 'RH', 'Tarefas', 'Calendário de Conteúdo', 'Briefing',
    ];

    const rowLabels = await page.locator('[data-testid^="entity-row-"] p.font-medium').allInnerTexts();
    expect(rowLabels).toEqual(expectedOrderedLabels);
  });

  test('Relatórios: Projetos aparece como entidade reportável com Importar/Exportar funcionais', async ({ page }) => {
    await page.goto('/relatorios', { waitUntil: 'networkidle' });
    const row = page.locator('[data-testid="entity-row-projects"]');
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.locator('[data-testid="btn-import-projects"]')).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      row.locator('[data-testid="btn-export-projects"]').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^projects.*\.xlsx$/);
  });

  test('Relatórios: exportação de Projetos é um workbook real com aba "Projetos" + aba filha "Músicas do Projeto" (Parte 87, Bloco 6 — nunca JSON numa célula)', async ({ page }) => {
    await page.goto('/relatorios', { waitUntil: 'networkidle' });
    const row = page.locator('[data-testid="entity-row-projects"]');
    await expect(row).toBeVisible({ timeout: 10_000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      row.locator('[data-testid="btn-export-projects"]').click(),
    ]);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const wb = XLSX.read(fs.readFileSync(filePath!));
    expect(wb.SheetNames).toEqual(['Projetos', 'Músicas do Projeto']);

    const mainHeader = XLSX.utils.sheet_to_json(wb.Sheets['Projetos'], { header: 1 })[0] as string[];
    expect(mainHeader).toEqual(['Projeto ID de referência', 'Tipo', 'Título', 'Observações', 'Situação']);

    const childHeader = XLSX.utils.sheet_to_json(wb.Sheets['Músicas do Projeto'], { header: 1 })[0] as string[];
    expect(childHeader).toEqual([
      'Projeto ID de referência', 'Nome', 'Solo/Feat', 'Original/Remix', 'Instrumental', 'Duração',
      'Gênero', 'Idioma', 'Compositores', 'Intérpretes', 'Produtores', 'Letra', 'Áudio', 'Ordem',
    ]);
  });

  test('Relatórios: exportação de Distribuição (releases, Parte 89) é um workbook real com aba principal + aba filha "Faixas do Lançamento", nenhum XLSX quebrado (0 registros também é sucesso)', async ({ page }) => {
    await page.goto('/relatorios', { waitUntil: 'networkidle' });
    const row = page.locator('[data-testid="entity-row-releases"]');
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.locator('[data-testid="btn-export-releases"]')).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      row.locator('[data-testid="btn-export-releases"]').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^releases.*\.xlsx$/);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const wb = XLSX.read(fs.readFileSync(filePath!));
    expect(wb.SheetNames[1]).toBe('Faixas do Lançamento');
    const childHeader = XLSX.utils.sheet_to_json(wb.Sheets['Faixas do Lançamento'], { header: 1 })[0] as string[];
    expect(childHeader[0]).toBe('Lançamento (ID de referência)');
    expect(childHeader).toContain('Nome');
    expect(childHeader).toContain('Compositores');
  });

  test('Relatórios: exportação de Contabilidade (relatório computado, Parte 89) funciona sem erro e sem botão Importar', async ({ page }) => {
    await page.goto('/relatorios', { waitUntil: 'networkidle' });
    const row = page.locator('[data-testid="entity-row-accounting_summary"]');
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.locator('[data-testid="btn-import-accounting_summary"]')).toBeDisabled();
    await expect(row.locator('[data-testid="btn-export-accounting_summary"]')).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      row.locator('[data-testid="btn-export-accounting_summary"]').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^accounting_summary.*\.xlsx$/);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const wb = XLSX.read(fs.readFileSync(filePath!));
    const header = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })[0] as string[];
    expect(header).toEqual(['Artista', 'Receitas', 'Despesas', 'Resultado', 'Margem (%)']);
  });
});
