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
import { ptWords, isPtProse } from "./pt-lexicon.mjs";

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

test("prose detector: short Portuguese test titles without function words are flagged", () => {
  for (const pt of ["rejeita senha vazia", "persiste failed quando provider falha", "recria RLS + policy (tenant_isolation)", "remove delega tenant + id"]) {
    assert.equal(isPtProse(pt), true, pt);
  }
  for (const en of ["rejects an empty password", "remove delegates tenant + id", "renders the 'Rejeita senha vazia' message", "maps 'legado' to legacy"]) {
    assert.equal(isPtProse(en), false, en);
  }
});

test("identifiers: destructured bindings are scanned like variables", () => {
  const src = `const [nomeCompleto, setNomeCompleto] = useState("");
const { valor, dataNascimento: birth } = row;
const [fullName, setFullName] = useState("");`;
  const vars = names(scanSource("apps/web/src/b.tsx", src), "identifier").sort();
  assert.deepEqual(vars, ["nomeCompleto", "setNomeCompleto", "valor"].sort());
});

test("identifiers: proper names without translation are not Portuguese technical names", () => {
  assert.deepEqual(names(scanSource("apps/web/src/p.ts", "const pixKey = ''; const chavePix = '';"), "identifier"), ["chavePix"]);
});

test("comments are read from the AST: real comments flagged, strings/URLs/MIME globs are not", () => {
  const real = `/* calcula o repasse do artista quando não há contrato */
const a = 1; // valida o valor antes de salvar no banco
export function View() {
  return <div>{/* mostra o formulário quando não há dados */}</div>;
}
// fim do arquivo: remove o cache quando não há sessão`;
  assert.equal(scanSource("apps/web/src/y.tsx", real).filter((h) => h.surface === "comment").length, 4);

  const noComments = `export function F() {
  return <input accept="image/*" placeholder="https://portal.exemplo.org.br (padrão)" />;
}
const note = "// calcula o valor quando não há contrato";
const tpl = \`/* remove o item quando não há estoque */\`;
export const X = <p>Texto: sem comentário */ aqui</p>;
export const Y = <p><b>Atenção</b> // não é comentário quando há texto no JSX</p>;`;
  assert.equal(scanSource("apps/web/src/z.tsx", noComments).filter((h) => h.surface === "comment").length, 0);
});

test("prose detector: quoted UX, hostnames and English 'via' are not Portuguese; short Portuguese still is", () => {
  // English prose that only quotes UX text or mentions hosts/paths (".com" is not the preposition "com")
  for (const english of [
    "renders the red 'Obra não encontrada no catálogo' alert",
    "maps DB 'under_review' to Select 'em_análise'",
    "SoundchartsService: metric methods only target customer.api.soundcharts.com/account.soundcharts.com hosts",
    "rejects a hostname other than open.spotify.com (CWE-20 — evil.com/artist/x)",
    "discovers tenants via ADMIN_DATA_SOURCE and processes via DATA_SOURCE + runInTenantContext",
    "// don't recompute: it's cached when the tenant is set",
  ]) assert.equal(isPtProse(english), false, english);
  // Portuguese prose, including short comments with a single function word plus a domain noun
  for (const portuguese of [
    "deve salvar o projeto quando o formulário é válido",
    "forceRefresh ignora o cache e gera novamente",
    "// Cria projeto via /projects (se existir)",
    "// Manter default aqui injectava 'draft' em PATCH parcial (via PartialType)",
  ]) assert.equal(isPtProse(portuguese), true, portuguese);
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

test("docs and non-code files are in the census: Markdown prose and every tracked path name", () => {
  const c = census();
  const keys = Object.keys({ ...c.debt, ...c.excepted });
  assert.ok(keys.some((k) => k.startsWith("doc::") && k.endsWith(".md")), "Markdown documents are scanned");
  assert.ok(c.filesScanned > 3000, `every tracked file is scanned (got ${c.filesScanned})`);
  assert.ok(keys.some((k) => k.startsWith("dbColumn::")), "physical columns are scanned");
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

test("object-literal keys and destructured property names are enforced (wire/DB field names)", () => {
  const hits = scanSource("apps/web/src/m.ts", `export const payload = { data_lancamento: x, nome: y, releaseDate: z };
const { valor: amount, title } = row;`);
  assert.deepEqual(names(hits, "objectKey"), ["data_lancamento", "nome", "valor"]);
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

test("values: Portuguese status/option values are flagged wherever they appear as tokens", () => {
  const src = `export enum ReleaseStatus { PLANNING = 'planejamento', DONE = 'done' }
type TxType = 'receita' | 'expense';
if (row.status === 'pendente') {}
switch (kind) { case 'pessoa_fisica': break; }
const OPTIONS = ['com_empresario', 'independent'] as const;
export const field = register('nomeArtistico');
<Button data-testid="button-salvar-obra" />;`;
  assert.deepEqual(names(scanSource("apps/web/src/v.tsx", src), "value").sort(),
    ["button-salvar-obra", "com_empresario", "nomeArtistico", "pendente", "pessoa_fisica", "planejamento", "receita"]);
});

test("values: UX text, UX attributes, PascalCase labels, module paths and test titles are not values", () => {
  const src = `import x from 'lancamento-utils';
const m = await import('./obra');
jest.mock('./artista');
export function F() {
  return <Input placeholder="nome" aria-label="fechar" title="Artista" label="valor">Salvar projeto</Input>;
}
const LABELS = { label: 'nome', title: 'Obra', message: 'pendente' };
toast.success('Obra salva com sucesso');
const name = 'Artista';
describe('rejeita senha vazia', () => {});`;
  assert.deepEqual(names(scanSource("apps/web/src/u.test.tsx", src), "value"), []);
});

test("frontend routes are enforced; English routes pass", () => {
  const src = `<Route path="/lancamentos" element={<A />} /><Route path="/releases" element={<B />} />`;
  assert.deepEqual(names(scanSource("apps/web/src/App.tsx", src), "frontendRoute"), ["/lancamentos"]);
});

test("paths: every Portuguese directory is reported with its full path, and non-code file names are checked", async () => {
  const { scanPath } = await import("./technical-naming-census.mjs");
  assert.deepEqual(scanPath("apps/web/src/modules/financeiro/regras/index.ts").map((h) => h.name),
    ["apps/web/src/modules/financeiro", "apps/web/src/modules/financeiro/regras"]);
  assert.deepEqual(scanPath("apps/web/scripts/tmp-chat-interno.png").map((h) => h.name), ["tmp-chat-interno.png"]);
  assert.deepEqual(scanPath("docs/runbooks/continuous-improvement.md"), []);
  assert.deepEqual(scanPath("docs/product-tasks/v5-backend-fixes.md"), []);
});

test("docs: Portuguese prose lines are counted, fenced code and English prose are not", async () => {
  const { scanMarkdown } = await import("./technical-naming-census.mjs");
  const md = ["# Guia de deploy", "Este documento descreve como fazer o deploy da API.", "", "```sql", "SELECT nome FROM clientes; -- não é prosa", "```",
    "This section explains the rollback path.", "Use `nome_artistico` only for the legacy import."].join("\n");
  assert.equal(scanMarkdown(md), 2);
});

test("vocabulary: missed Portuguese words are now detected; English technical vocabulary never is", () => {
  for (const pt of ["agencia", "galeria", "foto", "especialidades", "parceira", "idioma", "banda", "cargo", "pago_em", "criada_por_ia", "duracao_seg", "com-obra"]) {
    assert.ok(ptWords(pt).length > 0, `expected Portuguese: ${pt}`);
  }
  for (const en of ["continuous", "fixes", "classes", "series", "tempo", "meta", "param", "resolver", "logo", "alias", "util", "dao", "modulo", "todo",
    "em", "qual", "com", "cores", "audiovisual", "whatsapp", "ecad", "musicos_app", "ipi_cae", "useIbgeLocations", "status", "data", "label", "total"]) {
    assert.deepEqual(ptWords(en), [], `expected English/technical: ${en}`);
  }
});

test("prose: single weak-signal Portuguese titles are caught; English titles naming legacy columns are not", () => {
  for (const pt of ["AdminDashboard — falha de query nunca vira KPI zerado fabricado", "concede SELECT/INSERT/UPDATE/DELETE às tabelas de leitura-escrita normal",
    "sem expectedUpdatedAt: aplica update incondicional", "respeita offset/limit passados", "calcula repasse artista"]) {
    assert.equal(isPtProse(pt), true, pt);
  }
  for (const en of ["maps nome -> name and tipo -> type", "renames data_inicio to start_date on contracts", "TipoTransacao is the legacy enum",
    "rejects unknown fields (nomeArtistico is legacy)"]) {
    assert.equal(isPtProse(en), false, en);
  }
});

test("legal-domain exceptions apply to their words: names built only from them are covered, others are not", async () => {
  const { exceptionIndex } = await import("./canonical-map.mjs");
  const idx = exceptionIndex({ exceptions: ["tomador", "nfe", "cpf", "cnpj"].map((n) => ({ currentName: n, path: "*", status: "ACTIVE" })) });
  for (const covered of ["tomador_email", "NfeConfigDialog.tsx", "cpfCnpj"]) assert.ok(idx.get("apps/web/src/a.ts", covered), covered);
  for (const notCovered of ["tomador_razao_social", "nomeCnpj"]) assert.equal(idx.get("apps/web/src/a.ts", notCovered), undefined, notCovered);
});

test("exceptions: a whole-file wildcard needs one exact path and a surface", async () => {
  const { validateStructure, exceptionIndex } = await import("./canonical-map.mjs");
  const base = { exceptionClass: "UX_TEXT", layer: "web", reason: "r", removalCondition: "c", status: "ACTIVE" };
  const bad = validateStructure({ statusVocabulary: { exceptionClass: ["UX_TEXT"] }, glossary: [], exceptions: [{ ...base, currentName: "*", path: "*" }] });
  assert.ok(bad.some((p) => /whole-file exception/.test(p)));
  const idx = exceptionIndex({ exceptions: [{ ...base, currentName: "*", path: "apps/web/src/i18n/pt-br.ts", surface: "value" }] });
  assert.ok(idx.get("apps/web/src/i18n/pt-br.ts", "pendente", "value"));
  assert.equal(idx.get("apps/web/src/i18n/pt-br.ts", "pendente", "objectKey"), undefined);
  assert.equal(idx.get("apps/web/src/other.ts", "pendente", "value"), undefined);
});

test("vocabulary integrity: the committed vocabulary loads fully and never contains an English override", async () => {
  const { PT_TOKENS, EN_OVERRIDES } = await import("./pt-lexicon.mjs");
  assert.ok(PT_TOKENS.size > 20000, `vocabulary size ${PT_TOKENS.size}`);
  for (const w of EN_OVERRIDES) assert.equal(PT_TOKENS.has(w), false, w);
});

test("links: route-like strings in web code are checked (path segments, query keys and values, templates)", () => {
  const src = `navigate("/lancamentos?view=" + id);
navigate(\`/registro-musicas?editObra=\${row.id}\`);
const back = "/configuracoes?aba=operacional&modulo=financeiro";
const ok = \`/releases?view=\${id}\`;
const api = "/artists/stats/genres";`;
  assert.deepEqual(names(scanSource("apps/web/src/l.tsx", src), "frontendRoute"),
    ["/lancamentos?view=", "/registro-musicas?editObra=${}", "/configuracoes?aba=operacional&modulo=financeiro"]);
  assert.deepEqual(names(scanSource("apps/api/src/l.ts", `const p = "/lancamentos";`), "frontendRoute"), []);
});

test("UX: strings rendered as JSX content and non-ASCII strings are never routes or values", () => {
  const src = `export const P = ({ plan }) => <span>{plan.period === "monthly" ? "/mês" : plan.period === "yearly" ? "/ano" : ""}</span>;
export const Q = ({ ok }) => <p>{ok && "pendente"}</p>;
const suffix = "/mês";`;
  const hits = scanSource("apps/web/src/p.tsx", src);
  assert.deepEqual(names(hits, "frontendRoute"), []);
  assert.deepEqual(names(hits, "value"), []);
});
