import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const docPath = path.join(root, 'docs', 'ENTERPRISE_BLUEPRINT_FINAL_2026-07-09.md');

function walk(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (full.includes(`${path.sep}node_modules${path.sep}`) || full.includes(`${path.sep}dist${path.sep}`)) continue;
    if (entry.isDirectory()) out.push(...walk(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out.sort();
}

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function table(headers, rows) {
  const escape = (value) => String(value ?? '').replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
  return [
    `| ${headers.map(escape).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escape).join(' | ')} |`),
  ].join('\n');
}

function listSection(title, items) {
  return [`### ${title}`, '', ...items.map((item) => `- \`${item}\``), ''].join('\n');
}

const apiModules = fs.readdirSync(path.join(root, 'apps/api/src/modules'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const webModules = fs.readdirSync(path.join(root, 'apps/web/src/modules'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const packages = fs.readdirSync(path.join(root, 'packages'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const migrations = walk(path.join(root, 'apps/api/src/database/migrations'), (f) => f.endsWith('.ts')).map(rel);
const supabaseMigrations = walk(path.join(root, 'supabase/migrations'), (f) => f.endsWith('.sql')).map(rel);

const mockFiles = walk(root, (f) => {
  const r = rel(f);
  if (r.startsWith('node_modules/') || r.startsWith('dist/') || r.startsWith('.git/')) return false;
  if (!/apps\/|packages\/|server\/|scripts\/|docs\/|supabase\//.test(r)) return false;
  return /(mock|fixture|seed|sample|demo|stub|fake)/i.test(path.basename(f));
}).map((f) => [rel(f), fs.statSync(f).size]);

const controllerFiles = walk(path.join(root, 'apps/api/src/modules'), (f) => f.endsWith('.controller.ts'));
const controllerRows = [];
for (const file of controllerFiles) {
  const lines = read(file).split(/\r?\n/);
  let controller = '';
  const methods = [];
  lines.forEach((line, index) => {
    const ctrl = line.match(/@Controller\(([^)]*)\)/);
    if (ctrl) controller = ctrl[1].trim() || '(root)';
    const method = line.match(/@(Get|Post|Put|Patch|Delete)\(([^)]*)\)/);
    if (method) methods.push(`${method[1]} ${method[2].trim() || '(root)'} @L${index + 1}`);
  });
  controllerRows.push([rel(file), controller, methods.join('; ') || 'NOT FOUND']);
}

const entityFiles = walk(path.join(root, 'apps/api/src'), (f) => f.endsWith('.entity.ts'));
const entityRows = entityFiles.map((file) => {
  const body = read(file);
  const entity = body.match(/@Entity\(([^)]*)\)/)?.[1]?.trim() ?? 'NOT FOUND';
  const cls = body.match(/export class\s+([A-Za-z0-9_]+)/)?.[1] ?? 'NOT FOUND';
  return [rel(file), cls, entity];
});

const dtoFiles = walk(path.join(root, 'apps/api/src/modules'), (f) => /\/dto\/.*\.ts$/.test(rel(f)));
const validatorFiles = walk(path.join(root, 'apps/api/src/modules'), (f) => /\/validators\/.*\.ts$/.test(rel(f)));
const webRouteFiles = walk(path.join(root, 'apps/web/src/app/routes'), (f) => f.endsWith('.tsx') || f.endsWith('.ts')).map(rel);
const webStores = walk(path.join(root, 'apps/web/src'), (f) => /(\.store|store\/).*\.ts(x)?$/.test(rel(f))).map(rel);
const webHooks = walk(path.join(root, 'apps/web/src'), (f) => /\/hooks\/.*\.ts(x)?$/.test(rel(f))).map(rel);
const webServices = walk(path.join(root, 'apps/web/src'), (f) => /\/services\/.*\.ts$/.test(rel(f))).map(rel);
const aiSkills = fs.readdirSync(path.join(root, 'packages/ai-skills/src'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const appendix = [
  '',
  '## 26. Mechanically Generated Appendices On 2026-07-09',
  '',
  'FACT FOUND',
  '',
  'The inventories below were generated mechanically from the local workspace to reduce manual omission. They complement, in the same document, the preceding analytical sections.',
  '',
  'EVIDENCE',
  '',
  '- Script gerador: `scripts/generate-blueprint-appendices.mjs`',
  '- Documento alvo: `docs/ENTERPRISE_BLUEPRINT_FINAL_2026-07-09.md`',
  '',
  listSection('26.1 API Modules', apiModules.map((m) => `apps/api/src/modules/${m}`)),
  listSection('26.2 Web Modules', webModules.map((m) => `apps/web/src/modules/${m}`)),
  listSection('26.3 Packages', packages.map((m) => `packages/${m}`)),
  listSection('26.4 TypeORM Migrations', migrations),
  listSection('26.5 Supabase Migrations', supabaseMigrations),
  '### 26.6 Mock/Seed/Fake/Stub/Sample/Demo Files',
  '',
  table(['file', 'bytes'], mockFiles),
  '',
  '### 26.7 API Controllers E Decorators HTTP',
  '',
  table(['file', 'controller', 'methods found'], controllerRows),
  '',
  '### 26.8 API Entities',
  '',
  table(['file', 'class', '@Entity'], entityRows),
  '',
  listSection('26.9 API DTO Files', dtoFiles.map(rel)),
  listSection('26.10 API Validator Files', validatorFiles.map(rel)),
  listSection('26.11 Web Route Files', webRouteFiles),
  listSection('26.12 Web Store Files', webStores),
  listSection('26.13 Web Hook Files', webHooks),
  listSection('26.14 Web Service Files', webServices),
  listSection('26.15 AI Skill Source Directories', aiSkills.map((s) => `packages/ai-skills/src/${s}`)),
  'RISCO',
  '',
  'This appendix lists files and decorators, but does not prove runtime execution of each endpoint. Where there was no integrated smoke, keep `NOT VALIDATED`.',
  '',
].join('\n');

let current = read(docPath);
current = current.replace(/\n## 26\. Apêndices Mecânicos Gerados Em 2026-07-09[\s\S]*$/u, '');
fs.writeFileSync(docPath, `${current.trimEnd()}\n${appendix}`, 'utf8');

