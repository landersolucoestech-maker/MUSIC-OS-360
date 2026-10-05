/**
 * Guard tests for the technical naming census (node --test).
 * Positive and negative cases per enforced surface; UX Portuguese must never trip it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanSource, compare, compareWildcard, scanMarkdownCode, isCurrentDocForCode, census, stripRecordId, isBookkeeping } from "./technical-naming-census.mjs";
import { loadAuthority } from "./canonical-map.mjs";
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
  const badDir = fs.mkdtempSync(path.join(os.tmpdir(), "naming-malformed-"));
  const badBaselinePath = path.join(badDir, "malformed.json");
  fs.writeFileSync(badBaselinePath, "{ not valid json");
  try {
    const r = spawnSync(process.execPath, [path.join(here, "technical-naming-census.mjs"), "--check"], {
      env: { ...process.env, NAMING_BASELINE_PATH: badBaselinePath }, encoding: "utf8",
    });
    assert.notEqual(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stderr, /technical-naming census FAILED/);
  } finally {
    fs.rmSync(badDir, { recursive: true, force: true });
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
  const idx = exceptionIndex({ exceptions: ["tomador", "prestador", "cpf", "cnpj"].map((n) => ({ currentName: n, path: "*", status: "ACTIVE" })) });
  for (const covered of ["tomador_email", "PrestadorConfigDialog.tsx", "cpfCnpj"]) assert.ok(idx.get("apps/web/src/a.ts", covered), covered);
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

test("external tool names: Rust Cargo.lock/Cargo.toml keys are not Portuguese; a real `cargo` key still is", () => {
  const lock = scanSource(".claude/runtime/discovery-engine.mjs", `const M = { "Cargo.lock": "cargo", "Cargo.toml": "cargo", "pnpm-lock.yaml": "pnpm" };`);
  assert.deepEqual(names(lock, "objectKey"), []);
  assert.deepEqual(names(scanSource("apps/api/src/a.ts", `const row = { cargo: 1 };`), "objectKey"), ["cargo"]);
  assert.deepEqual(names(scanSource("apps/api/src/a.ts", `const row = { "cargo.lock": 1 };`), "identifier"), ["cargo.lock"]);
});

test("lexicon: `eua` abbreviation and NF-e/NFS-e/NFC-e fiscal document types are external vocabulary", () => {
  assert.deepEqual(ptWords("_eua"), []);
  assert.deepEqual(ptWords("expectedUpdatedAt_eua"), []);
  for (const n of ["nfse", "nfe", "nfce", "NFe", "NFSe", "NFCe", "NfeConfigDialog", "useNfse", "NFCe_SERIES", "isNFe"]) assert.deepEqual(ptWords(n), [], n);
  const src = `export const FISCAL_DOC_TYPES = ["nfse", "nfe", "nfce"] as const;`;
  assert.deepEqual(names(scanSource("apps/api/src/modules/invoices/invoice-schema.ts", src), "value"), []);
  // Portuguese words next to them are still reported
  assert.deepEqual(ptWords("nfeTomador"), ["tomador"]);
});

test("lexicon: pg_policies `qual` column compounds are technical, Portuguese `qual_*` names still are not", () => {
  assert.deepEqual(ptWords("qual"), []);
  assert.deepEqual(ptWords("qualSnippet"), []);
  assert.deepEqual(ptWords("qualIncludes"), []);
  assert.deepEqual(ptWords("policy_qual_expr"), []);
  assert.equal(ptWords("qual_artista").includes("artista"), true);
});

test("user-input vocabulary: only the exact value in the exact file is exempt", () => {
  const src = `const PARTICLES = new Set(["das", "dos"]); const other = "projeto";`;
  assert.deepEqual(names(scanSource("apps/web/src/shared/lib/format-name.ts", src), "value"), ["projeto"]);
  assert.deepEqual(names(scanSource("apps/web/src/shared/lib/other.ts", `const x = "das";`), "value"), ["das"]);
  assert.deepEqual(names(scanSource("apps/api/src/modules/reports/import/import-validation.service.ts", `const t = ["sim", "verdadeiro"]; const u = "lancamento";`), "value"), ["lancamento"]);
});

test("detector fixtures: audit tooling and the rename table are vocabulary, their identifiers are still checked", () => {
  const src = `const OLD = "artistaService"; const salvarProjeto = 1;`;
  for (const f of [".audit-runtime/census-pt-columns.ts", "scripts/run-technical-english-normalization.mjs"]) {
    const hits = scanSource(f, src);
    assert.deepEqual(names(hits, "value"), [], f);
    assert.deepEqual(names(hits, "identifier"), ["salvarProjeto"], f);
  }
});

test("UX: `itemLabel` literals are user-visible copy", () => {
  assert.deepEqual(names(scanSource("apps/web/src/List.tsx", `export const L = () => <Picker itemLabel="projeto" />;`), "value"), []);
});

test("values: VALUE_SHAPE is accent-aware, so accented machine values are no longer invisible", () => {
  const src = `const kinds = ['iluminação', 'lançamento']; const label = "Iluminação"; const x = "não é";`;
  assert.deepEqual(names(scanSource("apps/web/src/inv.tsx", src), "value").sort(), ["iluminação", "lançamento"].sort());
});

test("values: PT content vocabulary (keyword probes, LLM tokens) is exempt only for the exact value in the exact file", () => {
  const src = `if (has('capa', 'cover')) return 'x'; const bad = 'projeto';`;
  assert.deepEqual(names(scanSource("apps/api/src/modules/assets/asset-classification.service.ts", src), "value"), ["projeto"]);
  assert.deepEqual(names(scanSource("apps/api/src/modules/assets/other.service.ts", `const k = 'capa';`), "value"), ["capa"]);
  assert.deepEqual(names(scanSource("packages/ai-skills/src/support-triage/parser.ts", `const t = ["sim", "não", "alta"]; const u = "urgente";`), "value"), ["urgente"]);
  assert.deepEqual(names(scanSource("apps/web/src/shared/lib/normalize.ts", `const t = ["sim", "não"];`), "value"), []);
});

test("external property names: ViaCEP and IBGE payload keys are exempt only in their reader files", () => {
  const src = `export interface Payload { logradouro: string; bairro: string; uf: string }
const row = { localidade: "x" };`;
  assert.deepEqual(names(scanSource("apps/web/src/shared/lib/masks.ts", src), "identifier"), []);
  assert.deepEqual(names(scanSource("apps/web/src/shared/lib/masks.ts", src), "objectKey"), []);
  assert.deepEqual(names(scanSource("apps/web/src/shared/lib/other.ts", src), "identifier").sort(), ["bairro", "logradouro", "uf"]);
  assert.deepEqual(names(scanSource("apps/web/src/modules/marketing/components/campaign-builder/useIbgeLocations.ts", `interface L { sigla: string; mesorregiao: string }`), "identifier"), []);
});

test("UX arguments: handleConcurrencyConflict / reportBulkResult nouns are copy; other calls are still checked", () => {
  const src = `handleConcurrencyConflict(error, "evento");
reportBulkResult(result, "excluída", "obra");
register("evento");`;
  assert.deepEqual(names(scanSource("apps/web/src/Page.tsx", src), "value"), ["evento"]);
});

test("Swagger examples: @ApiProperty({ example }) is documentation, an enum/default value is not", () => {
  const src = `class D {
  @ApiProperty({ example: 'uuid-do-contrato' }) id!: string;
  @ApiPropertyOptional({ example: 'gravacao' }) type?: string;
  @ApiProperty({ default: 'gravacao' }) other!: string;
}`;
  assert.deepEqual(names(scanSource("apps/api/src/modules/x/dto/x.dto.ts", src), "value"), ["gravacao"]);
});

test("ABRAMUS vendor row fields are external property names in useAbramus.ts only", () => {
  const src = `type Row = { duracao?: string; compositores?: string[]; data_registro?: string; artista_nome?: string };`;
  assert.deepEqual(names(scanSource("apps/web/src/modules/integrations/hooks/useAbramus.ts", src), "identifier"), []);
  assert.deepEqual(names(scanSource("apps/web/src/modules/other/Other.ts", src), "identifier"), ["duracao", "compositores", "data_registro", "artista_nome"]);
});

test("fixture record ids: an uppercase code with a number (ABR-123) is not a Portuguese word; the rest of the value is still checked", () => {
  assert.equal(stripRecordId("abramus-result-ABR-123"), "abramus-result-");
  assert.deepEqual(names(scanSource("apps/web/src/test/Row.test.tsx", `screen.getByTestId("abramus-result-ABR-123"); screen.getByTestId("badge-already-imported-ABR-123");`), "value"), []);
  assert.deepEqual(names(scanSource("apps/web/src/test/Row.test.tsx", `screen.getByTestId("abramus-faixa-ABR-123"); const q = "abr";`), "value"), ["abramus-faixa-ABR-123", "abr"]);
});

test("capitalized Portuguese values: a classification field written or compared verbatim is data, label maps and free text are not", () => {
  const caps = (path, src) => scanSource(path, src).filter((h) => h.kind === "capitalized-string").map((h) => h.name);
  const persisted = `const tasks = [{ sector: "Comunicação", task: "Escrever copy" }, { sector: "Administração Musical", task: "Registrar" }];
if (row.sector === "Distribuição Digital") {}
const q = { queue: "Atendimento" };`;
  assert.deepEqual(caps("apps/web/src/modules/marketing/services/x.ts", persisted), ["Comunicação", "Administração Musical", "Distribuição Digital", "Atendimento"]);
  // UX: label/title keys, English-keyed label maps, sentences and messages never match
  assert.deepEqual(caps("apps/web/src/Page.tsx", `const a = { label: "Comunicação", title: "Administração Musical" }; const m = { pending: "Pendente", sector: "Preencha o setor." }; const s = { sector: "Um setor de comunicação" };`), []);
  // PT-BR label resources are display text by construction
  assert.deepEqual(caps("apps/api/src/modules/reports/i18n/field-labels.pt-br.ts", `export const L = { sector: "Setor", department: "Departamento" };`), []);
  // a name that is not Portuguese is not reported
  assert.deepEqual(caps("apps/web/src/modules/x.ts", `const p = { sector: "Marketing", queue: "Ana Maria" };`), []);
  // generic keys are not persisted-field keys
  assert.deepEqual(caps("apps/web/src/modules/x.ts", `const p = { name: "Comunicação", type: "Financeiro" };`), []);
});

test("living glossary/map docs: only whole-document ledger rows with surface doc exempt Markdown, for the two documents that are the Portuguese vocabulary", () => {
  const LIVING = new Set(["docs/engineering/ux-language-glossary.md", "docs/NAMING_NORMALIZATION_CANONICAL_MAP.md"]);
  const rows = loadAuthority().exceptions.filter((e) => e.surface === "doc" && e.census !== "baselined");
  assert.ok(rows.length >= 2, "both living documents are ledgered");
  for (const e of rows) {
    assert.ok(LIVING.has(e.path), `${e.path}: a whole-document exemption is reserved for the glossary and the generated map`);
    assert.equal(e.currentName, "*");
    assert.equal(e.exceptionClass, "UX_TEXT");
    assert.ok(e.reason.length > 60 && e.removalCondition);
  }
  const c = census();
  for (const f of LIVING) {
    assert.ok(`doc::${f}` in c.excepted, `${f} is counted as excepted`);
    assert.ok(!(`doc::${f}` in c.debt), `${f} is not debt`);
  }
  assert.ok(Object.keys(c.debt).some((k) => k.startsWith("doc::docs/") && !k.endsWith("CANONICAL_MAP.md")), "other documents are still counted");
});

test("every census exemption table has a ledger row (id, owner, removal condition, target state) referenced next to the table", () => {
  const src = fs.readFileSync(path.join(here, "technical-naming-census.mjs"), "utf8");
  const exceptions = loadAuthority().exceptions;
  const tables = ["VENDORED", "DETECTOR_FIXTURES", "USER_INPUT_VOCABULARY", "PT_CONTENT_VOCABULARY", "EXTERNAL_PROPERTY_NAMES", "EXTERNAL_TOOL_NAMES", "UX_ARGUMENT_CALLEES"];
  for (const table of tables) {
    const m = src.match(new RegExp(`/\\*\\*(?:(?!\\*/)[\\s\\S])*?\\*/\\s*export const ${table}\\b`));
    assert.ok(m, `${table}: declaration with a doc comment not found`);
    const ref = m[0].match(/ledger: (EXM-[A-Z-]+)/);
    assert.ok(ref, `${table}: add a 'ledger: EXM-...' reference in the comment next to the table`);
    const rows = exceptions.filter((e) => e.id === ref[1]);
    assert.equal(rows.length, 1, `${table}: ledger row ${ref[1]} missing or duplicated`);
    const [r] = rows;
    assert.equal(r.currentName, table);
    assert.equal(r.status, "ACTIVE");
    for (const f of ["owner", "reason", "consumer", "removalCondition", "targetState"]) assert.ok(r[f], `${table}: ${ref[1]} lacks ${f}`);
  }
  // no extra EXM row without a table
  const declared = new Set(tables);
  for (const e of exceptions.filter((x) => x.id?.startsWith("EXM-"))) assert.ok(declared.has(e.currentName), `${e.id} has no exemption table`);
});

test("ledger rows for the frozen audit docs exist and are accepted by the structure validator", async () => {
  const { validateStructure } = await import("./canonical-map.mjs");
  const map = loadAuthority();
  assert.deepEqual(validateStructure(map), []);
  const baseline = JSON.parse(fs.readFileSync(path.join(here, "technical-naming-baseline.json"), "utf8"));
  const records = map.exceptions.filter((e) => e.census === "baselined");
  assert.ok(records.length >= 3 && records.every((e) => e.owner && e.removalCondition && e.targetState && e.reason));
  const covered = records.flatMap((e) => e.path.split(/\s*,\s*/));
  assert.equal(new Set(covered).size, covered.length, "a baselined doc is covered by exactly one record row");
  // every baselined doc is owned by a record row, and no record row outlives its baseline entry
  const baselinedDocs = Object.keys(baseline.debt).filter((k) => k.startsWith("doc::")).map((k) => k.slice(5)).sort();
  assert.deepEqual([...covered].sort(), baselinedDocs);
  // records never suppress: the census still counts them as debt
  const c = census();
  for (const f of covered) assert.ok(`doc::${f}` in c.debt && !(`doc::${f}` in c.excepted), `${f} stays ratcheted debt`);
});

// ---- dataFile surface: technical names inside tracked non-code data files ----

test("dataFile: SQL identifiers are scanned, comments and string literals are not", async () => {
  const { scanData } = await import("./technical-naming-census.mjs");
  const sql = `-- comentário em português sobre o artista\nSELECT 'Artista Demo, descrição livre' AS label;\nINSERT INTO artists (stage_name, nome_artistico) VALUES ('x', 'y');\n/* categoria */`;
  assert.deepEqual(scanData("apps/api/seed.sql", sql), ["nome_artistico"]);
  assert.deepEqual(scanData("apps/api/seed.sql", "INSERT INTO artists (stage_name, full_name) VALUES ('a', 'b');"), []);
});

test("dataFile: JSON keys and token-shaped values are scanned, free text is not", async () => {
  const { scanData } = await import("./technical-naming-census.mjs");
  const json = JSON.stringify({ artista_id: "x", note: "Texto livre em português com acentuação", status: "ativo", level: "CRITICO", ok: "active" });
  assert.deepEqual(scanData("x/data.json", json), ["CRITICO", "artista_id", "ativo"]);
  assert.deepEqual(scanData("x/data.json", "{ not json"), []);
});

test("dataFile: YAML and TOML keys are scanned", async () => {
  const { scanData } = await import("./technical-naming-census.mjs");
  assert.deepEqual(scanData("x/c.yml", "descricao: texto\nname: ok\n  - tipo_servico: y\n"), ["descricao", "tipo_servico"]);
  assert.deepEqual(scanData("x/c.toml", "titulo = 'a'\nname = 'b'\n"), ["titulo"]);
});

test("dataFile: lockfiles are not data files, migrations are skipped by the census loop", async () => {
  const { isDataFile } = await import("./technical-naming-census.mjs");
  assert.equal(isDataFile("pnpm-lock.yaml"), false);
  assert.equal(isDataFile("docs/archive/meta/_journal.json"), true);
  assert.equal(isDataFile("apps/api/seed.sql"), true);
  assert.equal(isDataFile("apps/web/index.html"), false);
});

test("dataFile: every Portuguese name in a tracked data file is covered by a ledger row (census sees no uncovered dataFile debt)", async () => {
  const { census } = await import("./technical-naming-census.mjs");
  const c = census();
  const debt = Object.keys(c.debt).filter((k) => k.startsWith("dataFile::"));
  assert.deepEqual(debt, []);
  assert.ok(Object.keys(c.excepted).some((k) => k.startsWith("dataFile::")), "the dataFile surface must be exercised by at least one covered file");
});

// ---- toolMessage surface: Portuguese prose in developer tooling strings ----

test("toolMessage: assertion names, log lines and skip reasons in Portuguese are found, English and short tokens are not", async () => {
  const { scanToolMessages } = await import("./technical-naming-census.mjs");
  const src = `ok('TEST 1: INSERT como Tenant A'); ok('TEST 1: INSERT as Tenant A'); test.skip(!x, 'variáveis ausentes — pulando E2E real.'); const k = 'artist_id'; const t = \`GET release retorna 200\`;`;
  assert.deepEqual(scanToolMessages("apps/api/scripts/x.ts", src), ["GET release retorna 200", "TEST 1: INSERT como Tenant A", "variáveis ausentes — pulando E2E real."]);
});

test("toolMessage: only developer tooling files are scanned", async () => {
  const { isToolingFile } = await import("./technical-naming-census.mjs");
  for (const f of ["scripts/a.mjs", "apps/api/scripts/a.ts", "e2e/a.spec.ts", "infra/a.js", ".claude/runtime/a.mjs"]) assert.equal(isToolingFile(f), true, f);
  for (const f of ["apps/web/src/a.tsx", "apps/api/src/a.ts", "docs/a.md", "scripts/a.json"]) assert.equal(isToolingFile(f), false, f);
});

test("toolMessage: every Portuguese tooling message is a documented exception (no uncovered debt)", async () => {
  const { census } = await import("./technical-naming-census.mjs");
  const c = census();
  assert.deepEqual(Object.keys(c.debt).filter((k) => k.startsWith("toolMessage::")), []);
  assert.ok(Object.keys(c.excepted).some((k) => k.startsWith("toolMessage::")));
});

// ---- member reads: `row.titulo`, `row['nome']` are technical uses of a Portuguese name ----

test("property-read: dotted and bracket member reads of a Portuguese name are found, English reads are not", () => {
  const src = "export const t = (row: Record<string, unknown>) => row.titulo ?? row['nome'] ?? row.title ?? row['name'];\n";
  const hits = scanSource("apps/web/src/m.ts", src).filter((h) => h.kind === "property-read");
  assert.deepEqual(hits.map((h) => h.name).sort(), ["nome", "titulo"]);
  assert.ok(hits.every((h) => h.surface === "identifier"));
});

test("property-read: process.env member reads stay on the envVar surface, not on the identifier surface", () => {
  const hits = scanSource("apps/api/src/m.ts", "export const v = process.env.SENHA_PADRAO;\n");
  assert.equal(hits.filter((h) => h.kind === "property-read").length, 0);
  assert.equal(hits.filter((h) => h.surface === "envVar").length, 1);
});

test("stale-row gate: a row matching no occurrence is reported in unusedRows; removing a covering row makes debt appear", async () => {
  const { exceptionIndex } = await import("./canonical-map.mjs");
  const authority = loadAuthority();
  const base = { exceptionClass: "TEMPORARY_MIGRATION_COMPATIBILITY", status: "ACTIVE" };
  const stale = { ...base, path: "apps/api/src/does-not-exist.ts", currentName: "nomeQueNaoExiste", surface: "identifier" };
  const staleWildcard = { ...base, path: "*", currentName: "zzzzstaleword" };
  const tableRegister = { ...base, id: "EXM-TEST-TABLE", path: "scripts/naming/technical-naming-census.mjs", currentName: "TEST_TABLE" };
  const covering = authority.exceptions.find((e) => e.status === "ACTIVE" && e.census !== "baselined" && e.path.startsWith("apps/") && !e.path.includes(",") && e.currentName !== "*");
  assert.ok(covering, "the ledger must hold at least one exact-path row to mutate");

  // (a) the committed ledger has no stale row; adding two rows that cover nothing makes exactly those two stale
  const withStale = census({ exceptions: exceptionIndex({ ...authority, exceptions: [...authority.exceptions, stale, staleWildcard, tableRegister] }) });
  // the EXM-* register row documents a census-internal table and is never a stale candidate
  assert.deepEqual(withStale.unusedRows, [stale, staleWildcard]);

  // (b) removing a row that covers an occurrence turns it into debt (and the row cannot be reported stale: it is gone)
  const without = census({ exceptions: exceptionIndex({ ...authority, exceptions: authority.exceptions.filter((e) => e !== covering) }) });
  assert.deepEqual(without.unusedRows, []);
  const grown = Object.keys(without.debt).filter((k) => k.includes(covering.path));
  assert.ok(grown.length > 0, `removing the row for ${covering.path} :: ${covering.currentName} must leave debt in that file`);
});

test("evidence: generated audit evidence and mission bookkeeping are not product surfaces, product data files are", () => {
  assert.equal(isBookkeeping("docs/naming/audit/compat-mutation-proof.json"), true);
  assert.equal(isBookkeeping(".claude/ops/records/x.json"), true);
  assert.equal(isBookkeeping("docs/naming/canonical-naming-map.json"), false);
  assert.equal(isBookkeeping("apps/api/src/data/seed.json"), false);
  assert.equal(isBookkeeping("docs/naming/auditoria/x.json"), false);
  assert.equal(isBookkeeping("docs/naming/audit/other-evidence.json"), false);
});

test("wildcard ratchet: a new name hidden by a whole-file row, or a new wildcard file, is reported; fewer names is a stale baseline", () => {
  const base = { "a.ts": 2 };
  assert.deepEqual(compareWildcard({ "a.ts": 2 }, base), { grown: [], shrunk: [] });
  assert.equal(compareWildcard({ "a.ts": 3 }, base).grown.length, 1);
  assert.equal(compareWildcard({ "a.ts": 2, "b.ts": 1 }, base).grown.length, 1);
  assert.equal(compareWildcard({ "a.ts": 1 }, base).shrunk.length, 1);
  assert.equal(compareWildcard({}, base).shrunk.length, 1);
});

test("wildcard ratchet: the census exposes per-file wildcard coverage and --check fails without the baseline section", () => {
  const c = census();
  assert.ok(Object.keys(c.wildcardCoverage).length > 100, "wildcard-covered files are counted");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "naming-wc-"));
  const baselinePath = path.join(dir, "no-wildcard.json");
  fs.writeFileSync(baselinePath, JSON.stringify({ totals: {}, debt: {} }));
  try {
    const r = spawnSync(process.execPath, [path.join(here, "technical-naming-census.mjs"), "--check"], { env: { ...process.env, NAMING_BASELINE_PATH: baselinePath }, encoding: "utf8" });
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.match(r.stderr, /wildcardCoverage/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("markdown code spans: a Portuguese technical name in a backtick span or fenced block of a current doc is found; English, legacy-marked lines and historical records are not", () => {
  assert.deepEqual(scanMarkdownCode("The field is `valor_total` here."), ["valor_total"]);
  assert.deepEqual(scanMarkdownCode("```ts\nconst x = { data_inicio: 1 };\n```\n"), ["data_inicio"]);
  assert.deepEqual(scanMarkdownCode("The field is `total_amount` here."), []);
  assert.deepEqual(scanMarkdownCode("Deprecated input alias `valor_total` maps to `total_amount`."), []);
  assert.deepEqual(scanMarkdownCode("> Historical record. Kept as recorded; not the current contract.\n\nThe field is `valor_total`."), []);
  assert.deepEqual(scanMarkdownCode("Plain prose with valor_total outside code is the prose scan's job."), []);
  assert.ok(isCurrentDocForCode("docs/engineering/security.md") && !isCurrentDocForCode("docs/backend-v2/01-x.md") && !isCurrentDocForCode("docs/product-tasks/task-1.md"));
});

// ---- gate coverage gaps closed by the independent probe: ALL-CAPS values, capitalized data positions, embedded SQL ----
const valueHits = (src, file = "apps/api/src/a.ts") => scanSource(file, src).filter((h) => h.surface === "value" || h.surface === "objectKey" || h.surface === "sqlString").map((h) => `${h.surface}:${h.kind}:${h.name}`);

test("ALL-CAPS Portuguese values: enum initializers, constant maps and arrays are found; English caps, UX props and module specifiers are not", () => {
  assert.deepEqual(valueHits(`export const L = { a: 'DIVERGENTE', b: "REMOVIDA", c: 'ARQUIVADA' };`), ["value:caps-string:DIVERGENTE", "value:caps-string:REMOVIDA", "value:caps-string:ARQUIVADA"]);
    assert.ok(valueHits(`export enum IdentifierProvider { PRO_MUSICA = "PRO_MUSICA" }`, "packages/types/src/enums.ts").includes("value:caps-string:PRO_MUSICA"));
  assert.deepEqual(valueHits(`export const H = ["TITULO", "DATA_FIM"];`, "apps/web/src/modules/events/lib/agenda-spreadsheet.ts"), ["value:caps-string:TITULO", "value:caps-string:DATA_FIM"]);
  assert.deepEqual(valueHits(`export const t = x === 'ISENTO' ? 1 : 2;`), ["value:caps-string:ISENTO"]);
  // negatives: English constants, UX attributes, labels, module specifiers
  assert.deepEqual(valueHits(`export const E = { a: 'ACTIVE', b: 'PENDING', c: 'DRAFT', d: 'GET' };`), []);
  assert.deepEqual(valueHits(`export const u = <Button label="SALVAR" aria-label="FECHAR" />;`, "apps/web/src/a.tsx"), []);
  assert.deepEqual(valueHits(`export const m = { label: "ISENTO", message: "ARQUIVADA" };`), []);
  assert.deepEqual(valueHits(`export const m = { 'ISENTO': 'Isento' };`, "apps/web/src/i18n/status.pt-br.ts").filter((x) => x.startsWith("value")), []);
});

test("capitalized data positions: comparisons against a classification field, switch/case, lookups, `in`, element access and classification arrays are found; display text is not", () => {
  assert.deepEqual(valueHits(`export const f = (r: any) => r.type === "Receita";`), ["value:capitalized-string:Receita"]);
  assert.deepEqual(valueHits(`export const f = (status: string) => { switch (status) { case "Pendente": return 1; default: return 0; } };`), ["value:capitalized-string:Pendente"]);
  assert.deepEqual(valueHits(`export const f = (m: any) => m["Comunicação"];`), ["value:capitalized-string:Comunicação"]);
  assert.deepEqual(valueHits(`export const f = (m: any) => "Comunicação" in m;`), ["value:capitalized-string:Comunicação"]);
  assert.deepEqual(valueHits(`export const f = (r: any) => ["Comunicação", "Marketing"].includes(r.sector);`), ["value:capitalized-string:Comunicação"]);
  assert.deepEqual(valueHits(`export const DEPARTMENTS = ["Jurídico", "Administrativo"];`), ["value:capitalized-string:Jurídico", "value:capitalized-string:Administrativo"]);
  assert.deepEqual(valueHits(`export const f = (r: any) => allowedStatuses.includes("Pendente");`), ["value:capitalized-string:Pendente"]);
  // objectKey: a capitalized/accented key is a lookup key
  assert.deepEqual(valueHits(`export const M = { "Comunicação": "communication", Design: "design" };`), ["objectKey:capitalized-key:Comunicação"]);
  // negatives: month-name arrays, label comparisons, substring probes, display props, label resources, tests building spreadsheet rows
  assert.deepEqual(valueHits(`export const MONTHS = ["Janeiro", "Fevereiro", "Março"];`), []);
  assert.deepEqual(valueHits(`export const f = (label: string, title: string) => label === "Artista" || title.includes("Artista");`), []);
  assert.deepEqual(valueHits(`export const f = <Tab title="Comunicação" label="Jurídico" placeholder="Receita" />;`, "apps/web/src/a.tsx"), []);
  assert.deepEqual(valueHits(`export const t = { status: "pending", title: "Comunicação" };`), []);
  assert.deepEqual(valueHits(`export const M = { "Comunicação": "Comunicação" };`, "apps/web/src/modules/x/labels.ts"), []);
  assert.deepEqual(valueHits(`const row = { "Título": 1 };`, "apps/web/src/modules/events/lib/agenda-spreadsheet.test.ts"), []);
});

test("sqlString: Portuguese identifiers and token-shaped literals inside embedded SQL are found; English SQL, prose literals, comments and non-SQL strings are not", async () => {
  const { scanSqlString } = await import("./technical-naming-census.mjs");
  assert.deepEqual(scanSqlString(`SELECT "type", count(*) FROM "transactions" WHERE lower("type") NOT IN ('receita','despesa','revenue') GROUP BY 1`), ["despesa", "receita"]);
  assert.deepEqual(scanSqlString(`UPDATE artists SET nome_artistico = $1 -- comentário do artista\nWHERE id = $2`), ["nome_artistico"]);
  assert.deepEqual(scanSqlString(`SELECT id FROM artists WHERE stage_name = 'Nome do Artista Demo' AND status = 'active'`), []);
  assert.deepEqual(valueHits("export const q = `SELECT (rolsuper OR rolbypassrls) AS bypass FROM pg_roles WHERE rolname = current_user`;", "apps/api/src/database/x.ts"), []);
  assert.deepEqual(valueHits("export const q = `UPDATE transactions SET categoria = ${'$'}{col} WHERE tipo = 'receita'`;", "apps/api/src/database/x.ts"), ["sqlString:sql:categoria", "sqlString:sql:receita", "sqlString:sql:tipo"]);
  assert.deepEqual(valueHits("export const q = `INSERT INTO artists (stage_name) VALUES ($1)`;", "apps/api/src/database/x.ts"), []);
  // UX prose that merely starts with an SQL-looking word is not SQL
  assert.deepEqual(valueHits(`export const m = "Select the artist to continue";`), []);
  assert.deepEqual(valueHits(`export const m = "Update the contract with the artista name";`), []);
  // published migrations stay immutable history
  assert.deepEqual(valueHits("export const q = `UPDATE x SET nome = 1`;", "apps/api/src/database/migrations/20260101_X.ts"), []);
});

test("caps values: a whole fixture record id (ABR-001-2025, ABR-TEST-001) is not Portuguese; a real caps word with a record-like suffix still is", () => {
  assert.equal(stripRecordId("ABR-001-2025"), "");
  assert.equal(stripRecordId("ABR-TEST-001"), "");
  assert.deepEqual(valueHits(`export const c = { society_code: "ABR-001-2025", other: "ABR-TEST-001" };`), []);
  assert.deepEqual(valueHits(`export const c = "META-BANCO";`), ["value:caps-string:META-BANCO"]);
});
