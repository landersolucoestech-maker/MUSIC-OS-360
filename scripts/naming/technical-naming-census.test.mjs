/**
 * Guard tests for the technical naming census (node --test).
 * Positive and negative cases per enforced surface; UX Portuguese must never trip it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanSource, compare, census } from "./technical-naming-census.mjs";
import { ptWords } from "./pt-lexicon.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const names = (hits, surface) => hits.filter((h) => h.surface === surface).map((h) => h.name);

test("symbols: rejects a Portuguese technical symbol, allows the English one", () => {
  assert.deepEqual(names(scanSource("apps/web/src/a.ts", "const salvarProjeto = () => 1;"), "identifier"), ["salvarProjeto"]);
  assert.deepEqual(names(scanSource("apps/web/src/a.ts", "export function saveProject() { return 1; }"), "identifier"), []);
});

test("symbols: detects unaccented Portuguese terms", () => {
  assert.deepEqual(names(scanSource("apps/api/src/a.ts", "let usuarioCobranca: string; type LancamentoRow = {};"), "identifier"), ["usuarioCobranca", "LancamentoRow"]);
});

test("UX: Portuguese JSX text, labels, toasts and string values are never flagged", () => {
  const src = `export function ProjectForm() {
    toast.error("Não foi possível salvar o projeto");
    const label = "Salvar projeto";
    return <><Label>Artista</Label><Button>Salvar</Button></>;
  }`;
  assert.deepEqual(scanSource("apps/web/src/ProjectForm.tsx", src).filter((h) => h.surface !== "comment"), []);
});

test("i18n keys: English key with pt-BR value is allowed; Portuguese technical key is rejected", () => {
  assert.deepEqual(names(scanSource("apps/web/src/i18n.ts", `export const m = { "project.save": "Salvar projeto" };`), "identifier"), []);
  assert.deepEqual(names(scanSource("apps/web/src/i18n.ts", `export const m = { "projeto.salvar": "Salvar projeto" };`), "identifier"), ["projeto.salvar"]);
});

test("filenames and folders", () => {
  assert.deepEqual(names(scanSource("apps/web/src/modules/releases/LancamentoFormModal.tsx", ""), "filename"), ["LancamentoFormModal.tsx"]);
  assert.deepEqual(names(scanSource("apps/web/src/modules/releases/ReleaseFormModal.tsx", ""), "filename"), []);
  assert.deepEqual(names(scanSource("apps/web/src/modules/financeiro/index.ts", ""), "directory"), ["financeiro"]);
  assert.deepEqual(names(scanSource("apps/web/src/modules/finance/index.ts", ""), "directory"), []);
});

test("events, queues, jobs: technical names are checked, UX labels in *EVENT* tables are not", () => {
  const bad = `export const DOMAIN_EVENTS = { A: 'lancamento.criado' } as const;
    @Processor('fila-pagamentos') class P {}`;
  assert.deepEqual(names(scanSource("apps/api/src/e.ts", bad), "eventQueueJob"), ["lancamento.criado", "fila-pagamentos"]);
  const good = `export const DOMAIN_EVENTS = { A: 'release.created' } as const;
    export const EVENT_STATUS_LABELS = { scheduled: 'Agendado', done: 'Concluído' };`;
  assert.deepEqual(names(scanSource("apps/api/src/e.ts", good), "eventQueueJob"), []);
});

test("env vars: process.env / import.meta.env names", () => {
  assert.deepEqual(names(scanSource("apps/api/src/c.ts", "const k = process.env.CHAVE_PAGAMENTO; const u = import.meta.env.VITE_URL_CONTRATO;"), "envVar"), ["CHAVE_PAGAMENTO", "VITE_URL_CONTRATO"]);
  assert.deepEqual(names(scanSource("apps/api/src/c.ts", "const k = process.env['STRIPE_SECRET_KEY'];"), "envVar"), []);
});

test("technical comments and test titles in Portuguese are flagged; English ones and quoted UX are not", () => {
  const src = `// calcula o valor do contrato para o artista quando não há data
    // computes the contract amount when the start date is missing
    it("deve salvar o projeto quando o formulário é válido", () => {});
    it("shows 'Salvar projeto' when editing a project", () => {});`;
  const hits = scanSource("apps/web/src/x.test.ts", src);
  assert.equal(hits.filter((h) => h.surface === "comment").length, 1);
  assert.deepEqual(names(hits, "testTitle"), ["deve salvar o projeto quando o formulário é válido"]);
});

test("API routes", () => {
  const src = `@Controller('lancamentos') class C { @Get('pendentes') a() {} }`;
  assert.deepEqual(names(scanSource("apps/api/src/c.controller.ts", src), "apiRoute"), ["/lancamentos", "/lancamentos/pendentes"]);
  assert.deepEqual(names(scanSource("apps/api/src/c.controller.ts", `@Controller('releases') class C { @Get('pending') a() {} }`), "apiRoute"), []);
});

test("ratchet: growth and stale (shrunk) baseline entries are both reported", () => {
  const r = compare({ "identifier::a.ts::variable::salvarProjeto": 1, "comment::b.ts": 1 }, { "comment::b.ts": 2, "filename::web:Obra.tsx": 1 });
  assert.deepEqual(r.grown, ["identifier::a.ts::variable::salvarProjeto (0 -> 1)"]);
  assert.deepEqual(r.shrunk.sort(), ["comment::b.ts (2 -> 1)", "filename::web:Obra.tsx (1 -> 0)"]);
});

test("unaccented Portuguese terms required by the owner brief are all detected by the lexicon", () => {
  for (const w of ["lancamento", "cobranca", "usuario", "projeto", "cliente", "fatura", "pagamento", "receita", "despesa"]) {
    assert.ok(ptWords(w).length > 0, `expected "${w}" to be detected as Portuguese`);
  }
});

test("unaccented Portuguese terms trip the identifier surface end-to-end (not just the lexicon in isolation)", () => {
  const src = "const clienteReceita = 1; const despesaFatura = 2; function usuarioProjeto() {}";
  assert.deepEqual(names(scanSource("apps/api/src/a.ts", src), "identifier").sort(), ["clienteReceita", "despesaFatura", "usuarioProjeto"]);
});

test("jobs: Portuguese job name in a *_JOB table is rejected, English one is allowed", () => {
  const bad = `export const REPORT_JOB_NAMES = { MONTHLY: 'gerar-relatorio-mensal' } as const;`;
  assert.deepEqual(names(scanSource("apps/api/src/j.ts", bad), "eventQueueJob"), ["gerar-relatorio-mensal"]);
  const good = `export const REPORT_JOB_NAMES = { MONTHLY: 'generate-monthly-report' } as const;`;
  assert.deepEqual(names(scanSource("apps/api/src/j.ts", good), "eventQueueJob"), []);
});

test("queues: @InjectQueue with a Portuguese queue name is rejected, English one is allowed", () => {
  const bad = `class W { constructor(@InjectQueue('fila-pagamentos') private readonly q: Queue) {} }`;
  assert.deepEqual(names(scanSource("apps/api/src/w.service.ts", bad), "eventQueueJob"), ["fila-pagamentos"]);
  const good = `class W { constructor(@InjectQueue('payments-queue') private readonly q: Queue) {} }`;
  assert.deepEqual(names(scanSource("apps/api/src/w.service.ts", good), "eventQueueJob"), []);
});

test("localization resource files: Portuguese values under English i18n keys are never flagged", () => {
  const src = `export const ptBR = {
    "project.save": "Salvar projeto",
    "release.title": "Título do lançamento",
    "release.status.published": "Publicado",
  };`;
  assert.deepEqual(scanSource("apps/web/src/locales/pt-BR.ts", src).filter((h) => h.surface !== "comment"), []);
});

test("fixtures: Portuguese sample data values under English keys are never flagged", () => {
  const src = `export const releaseFixture = {
    title: "Novo lançamento de verão",
    status: "Publicado",
    label: "Gravadora Independente",
  };`;
  assert.deepEqual(scanSource("apps/web/src/modules/releases/__fixtures__/release.fixture.ts", src), []);
});

test("UX test expectations (expect(...).toBe(...) / getByText(...)) are never flagged, only test titles are", () => {
  const src = `it("renders the save label", () => {
    expect(screen.getByText("Salvar")).toBeInTheDocument();
    expect(result).toBe("Salvar");
  });`;
  assert.deepEqual(scanSource("apps/web/src/x.test.tsx", src), []);
});

test("user docs and non-code files are excluded from the census by construction (only tracked code extensions are scanned)", () => {
  const c = census();
  const keys = [...Object.keys(c.debt), ...Object.keys(c.excepted)];
  assert.equal(keys.some((k) => /\.(md|mdx|txt|json|ya?ml)(::|$)/.test(k)), false);
});

test("tooling error: a malformed baseline JSON fails explicitly (never false success)", () => {
  const badBaselinePath = path.join(here, "does-not-exist-malformed.json");
  fs.writeFileSync(badBaselinePath, "{ not valid json");
  try {
    const r = spawnSync(process.execPath, [path.join(here, "technical-naming-census.mjs"), "--check"], {
      env: { ...process.env, NAMING_BASELINE_PATH: badBaselinePath }, encoding: "utf8",
    });
    assert.notEqual(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stderr, /technical-naming census FAILED/);
  } finally {
    fs.unlinkSync(badBaselinePath);
  }
});

test("tooling error: a missing baseline fails explicitly (exit 2), never false success", () => {
  const r = spawnSync(process.execPath, [path.join(here, "technical-naming-census.mjs"), "--check"], {
    env: { ...process.env, NAMING_BASELINE_PATH: path.join(here, "does-not-exist.json") }, encoding: "utf8",
  });
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /baseline not found/);
});

test("events: string-literal unions of *Event* types and camelCase/PascalCase event tables are checked", () => {
  const bad = `export type AnalyticsEventName = "lancamento.created" | "release.created";
    export const DomainEvents = { A: "contrato.signed" };`;
  assert.deepEqual(names(scanSource("apps/web/src/e.ts", bad), "eventQueueJob"), ["lancamento.created", "contrato.signed"]);
  const good = `export type AnalyticsEventName = "release.created" | "contract.signed";`;
  assert.deepEqual(names(scanSource("apps/web/src/e.ts", good), "eventQueueJob"), []);
});

test("object-literal keys are a report-only surface (wire/DB field names), never debt", () => {
  const hits = scanSource("apps/web/src/m.ts", `export const payload = { data_lancamento: x, nome: y };`);
  assert.deepEqual(names(hits, "objectKey"), ["data_lancamento", "nome"]);
  assert.deepEqual(names(hits, "identifier"), []);
});

test("API routes declared as path arrays: each Portuguese alias is reported", () => {
  const src = `@Controller('works') class C { @Get(['stats/genres', 'stats/generos']) a() {} }`;
  assert.deepEqual(names(scanSource("apps/api/src/c.controller.ts", src), "apiRoute"), ["/works/stats/generos"]);
});

test("exceptions are exact: one name in one file (or '*' only for legal-domain terms), never a substring allowlist", async () => {
  const { exceptionIndex } = await import("./canonical-map.mjs");
  const idx = exceptionIndex({ exceptions: [
    { currentName: "/works/stats/generos", path: "apps/api/src/modules/works/works.controller.ts", status: "ACTIVE" },
    { currentName: "cnpj", path: "*", status: "ACTIVE" },
  ] });
  assert.ok(idx.get("apps/api/src/modules/works/works.controller.ts", "/works/stats/generos"));
  assert.equal(idx.get("apps/api/src/modules/other.controller.ts", "/works/stats/generos"), undefined);
  assert.equal(idx.get("apps/api/src/modules/works/works.controller.ts", "/works/stats/generosX"), undefined);
  assert.ok(idx.get("apps/web/src/any.ts", "cnpj"));
});
