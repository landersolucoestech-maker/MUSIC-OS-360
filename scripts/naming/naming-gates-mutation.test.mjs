/**
 * Gate-level mutation tests: a minimal repository (the real census scripts and lexicon, a tiny entities.ts, an empty
 * baseline) is mutated one defect at a time, and the REAL census gate must fail on each one and pass on the clean tree.
 * This proves the gate exercises each surface end to end (scan, ledger, ratchet, exit code), not only the pure scanners.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");

tree.cleanEntities = "@Entity('artists') export class ArtistEntity { @Column() stage_name: string; }\n";
function tree(extra = {}, ledger = null) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "naming-mutation-"));
  fs.mkdirSync(path.join(root, "scripts/naming"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs/naming"), { recursive: true });
  fs.mkdirSync(path.join(root, "apps/api/src/database"), { recursive: true });
  for (const f of fs.readdirSync(here)) if (/\.(mjs|txt)$/.test(f) && !/\.test\.mjs$/.test(f)) fs.copyFileSync(path.join(here, f), path.join(root, "scripts/naming", f));
  const map = JSON.parse(fs.readFileSync(path.join(repo, "docs/naming/canonical-naming-map.json"), "utf8"));
  // the ledger file itself is registry data (its own whole-file row stays); every other exception is dropped
  const own = map.exceptions.filter((e) => e.path === "docs/naming/canonical-naming-map.json");
  map.exceptions = [...own, ...(ledger ?? [])];
  fs.writeFileSync(path.join(root, "docs/naming/canonical-naming-map.json"), JSON.stringify(map));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "fixture", private: true }));
  fs.symlinkSync(path.join(repo, "node_modules"), path.join(root, "node_modules"));
  fs.writeFileSync(path.join(root, "baseline.json"), JSON.stringify({ totals: {}, debt: {}, wildcardCoverage: {} }));
  fs.writeFileSync(path.join(root, "apps/api/src/database/entities.ts"), "@Entity('artists') export class ArtistEntity { @Column() stage_name: string; }\n");
  fs.writeFileSync(path.join(root, "apps/api/src/clean.ts"), "export const stageName = 'active';\n");
  for (const [rel, content] of Object.entries(extra)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["add", "-A"], { cwd: root, stdio: "ignore" });
  // baseline of the CLEAN fixture (the ledger file's own whole-file row hides some names); the mutation is the only change after it
  const clean = tree.cleanEntities;
  const mutated = {};
  for (const rel of Object.keys(extra)) {
    const abs = path.join(root, rel);
    mutated[rel] = fs.readFileSync(abs, "utf8");
    if (rel === "apps/api/src/database/entities.ts") fs.writeFileSync(abs, clean); else fs.rmSync(abs);
  }
  execFileSync("git", ["add", "-A"], { cwd: root, stdio: "ignore" });
  execFileSync(process.execPath, [path.join(root, "scripts/naming/technical-naming-census.mjs"), "--write"], { cwd: root, stdio: "ignore", env: { ...process.env, NAMING_BASELINE_PATH: path.join(root, "baseline.json") } });
  for (const [rel, content] of Object.entries(mutated)) fs.writeFileSync(path.join(root, rel), content);
  execFileSync("git", ["add", "-A"], { cwd: root, stdio: "ignore" });
  return root;
}

function gate(root) {
  const run = spawnSync(process.execPath, [path.join(root, "scripts/naming/technical-naming-census.mjs"), "--check"], {
    cwd: root, encoding: "utf8", env: { ...process.env, NAMING_BASELINE_PATH: path.join(root, "baseline.json") },
  });
  fs.rmSync(root, { recursive: true, force: true });
  return run;
}

test("the clean fixture passes the real gate", () => {
  const run = gate(tree());
  assert.equal(run.status, 0, run.stderr);
});

const MUTATIONS = [
  ["identifier", { "apps/api/src/m.ts": "export const nomeArtistico = 1;\n" }, /identifier::apps\/api\/src\/m\.ts/],
  ["member read of a legacy field", { "apps/web/src/m.ts": "export const t = (row: Record<string, unknown>) => row.titulo ?? row.title;\n" }, /identifier::apps\/web\/src\/m\.ts::property-read::titulo/],
  ["object key", { "apps/api/src/m.ts": "export const dto = { artista_id: 1 };\n" }, /objectKey::apps\/api\/src\/m\.ts/],
  ["string value", { "apps/api/src/m.ts": "export const STATUS = 'ativo';\n" }, /value::apps\/api\/src\/m\.ts/],
  ["ALL-CAPS Portuguese string value", { "apps/api/src/m.ts": "export const LABEL = { a: 'DIVERGENTE' };\n" }, /value::apps\/api\/src\/m\.ts::caps-string::DIVERGENTE/],
  ["ALL-CAPS Portuguese enum initializer", { "packages/types/src/m.ts": "export enum Provider { PRO_MUSICA = \"PRO_MUSICA\" }\n" }, /value::packages\/types\/src\/m\.ts::caps-string::PRO_MUSICA/],
  ["capitalized Portuguese key", { "apps/web/src/m.ts": "export const MAP = { \"Comunicação\": 'communication' };\n" }, /objectKey::apps\/web\/src\/m\.ts::capitalized-key::Comunicação/],
  ["capitalized Portuguese case clause on a classification field", { "apps/api/src/m.ts": "export const f = (status: string) => { switch (status) { case 'Pendente': return 1; default: return 0; } };\n" }, /value::apps\/api\/src\/m\.ts::capitalized-string::Pendente/],
  ["capitalized Portuguese lookup (includes on a classification array)", { "apps/api/src/m.ts": "export const f = (v: string) => ['Jurídico', 'Comercial'].includes(v) && DEPARTMENTS.includes('Jurídico');\n" }, /value::apps\/api\/src\/m\.ts::capitalized-string::Jurídico/],
  ["Portuguese identifier in embedded SQL of a runtime file", { "apps/api/src/m.ts": "export const q = `UPDATE transactions SET categoria = $1 WHERE tipo = 'receita'`;\n" }, /sqlString::apps\/api\/src\/m\.ts::sql::categoria/],
  ["Portuguese literal value in embedded SQL of a runtime file", { "apps/api/src/m.ts": "export const q = `SELECT 1 FROM transactions WHERE lower(type) IN ('despesa','revenue')`;\n" }, /sqlString::apps\/api\/src\/m\.ts::sql::despesa/],
  ["file name", { "apps/api/src/contratos.service.ts": "export const x = 1;\n" }, /filename::apps\/api\/src\/contratos\.service\.ts/],
  ["tooling message", { "scripts/m.mjs": "console.log('Registro criado com sucesso para o artista');\n" }, /toolMessage::scripts\/m\.mjs/],
  ["SQL identifier outside migrations", { "apps/api/seed.sql": "INSERT INTO artists (stage_name, nome_artistico) VALUES ('a', 'b');\n" }, /dataFile::apps\/api\/seed\.sql::nome_artistico/],
  ["JSON key", { "apps/api/data.json": "{ \"artista_id\": 1 }\n" }, /dataFile::apps\/api\/data\.json::artista_id/],
  ["database column (entity)", { "apps/api/src/database/entities.ts": "@Entity('artists') export class ArtistEntity { @Column() stage_name: string; @Column() nome_artistico: string; }\n" }, /dbColumn::artists\.nome_artistico/],
  ["shared types package", { "packages/types/src/m.ts": "export interface Contrato { valorTotal: number }\n" }, /identifier::packages\/types\/src\/m\.ts/],
  ["API route", { "apps/api/src/m.controller.ts": "@Controller('contratos') export class MController {}\n" }, /apiRoute::apps\/api\/src\/m\.controller\.ts/],
  ["env var", { "apps/api/src/m.ts": "export const k = process.env.CHAVE_SECRETA_API;\n" }, /envVar::apps\/api\/src\/m\.ts/],
  ["event / queue name", { "apps/api/src/m.ts": "export const q = new Queue('envio-relatorio');\n" }, /envio-relatorio/],
  ["YAML / config key", { "infra/m.yaml": "nome_servico: api\n" }, /dataFile::infra\/m\.yaml::nome_servico/],
  ["e2e helper identifier", { "e2e/m.ts": "export function criarContrato() { return 1; }\n" }, /identifier::e2e\/m\.ts/],
  ["Portuguese technical name in a backtick span of a current doc", { "docs/engineering/guide.md": "# Guide\n\nThe field is `valor_total` in the payload.\n" }, /docCode::docs\/engineering\/guide\.md/],
  ["Portuguese technical name in a fenced block of a current doc", { "docs/engineering/guide.md": "# Guide\n\n```ts\nconst payload = { data_inicio: 1 };\n```\n" }, /docCode::docs\/engineering\/guide\.md/],
  ["Portuguese technical name next to a common English word (not a legacy marker) in a current doc", { "docs/engineering/guide.md": "# Guide\n\nUse `valor_total` from the payload.\n" }, /docCode::docs\/engineering\/guide\.md/],
  ["storage key (localStorage)", { "apps/web/src/m.ts": "export const read = () => localStorage.getItem('filtro_salvo_artistas');\n" }, /value::apps\/web\/src\/m\.ts/],
  ["query key", { "apps/web/src/m.ts": "export const keys = { list: ['contratos', 'lista'] };\n" }, /value::apps\/web\/src\/m\.ts/],
  ["feature flag key", { "apps/web/src/m.ts": "export const isOn = (flags: Record<string, boolean>) => flags['nova_tela_financeiro'];\n" }, /(value|identifier|objectKey)::apps\/web\/src\/m\.ts/],
  ["Portuguese prose in a document", { "docs/guia.md": "# Guia\n\nEste documento descreve como configurar o ambiente de desenvolvimento local para a equipe.\n" }, /doc::docs\/guia\.md/],
];

for (const [name, files, expected] of MUTATIONS) {
  test(`mutation: ${name} fails the real gate`, () => {
    const run = gate(tree(files));
    assert.equal(run.status, 1, `${name} must fail the gate; stdout=${run.stdout} stderr=${run.stderr}`);
    assert.match(run.stderr, expected);
  });
}

test("a ledger row covering exactly that file and name lets the same mutation pass (and only that one)", () => {
  const row = { item: "fixture", path: "apps/api/src/m.ts", currentName: "nomeArtistico", surface: "identifier", layer: "backend", exceptionClass: "LEGACY_DATABASE_COMPATIBILITY", status: "ACTIVE" };
  const run = gate(tree({ "apps/api/src/m.ts": "export const nomeArtistico = 1;\n" }, [row]));
  assert.equal(run.status, 0, run.stderr);
  const other = gate(tree({ "apps/api/src/m.ts": "export const nomeArtistico = 1;\nexport const nomeCliente = 2;\n" }, [row]));
  assert.equal(other.status, 1);
  assert.match(other.stderr, /nomeCliente/);
});

test("moving the defect to another tracked path does not escape the gate", () => {
  for (const rel of ["apps/web/src/m.ts", "packages/utils/src/m.ts", "e2e/m.ts", "scripts/m.ts"]) {
    const run = gate(tree({ [rel]: "export const nomeArtistico = 1;\n" }));
    assert.equal(run.status, 1, rel);
  }
});
